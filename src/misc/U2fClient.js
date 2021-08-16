//@flow
import {TutanotaError} from "../api/common/error/TutanotaError"
import {base64ToBase64Url, base64ToUint8Array, base64UrlToBase64, uint8ArrayToBase64} from "../api/common/utils/Encoding"
import {assertMainOrNode, getHttpOrigin, isAdminClient, isApp, isDesktop} from "../api/common/Env"
import {BadRequestError} from "../api/common/error/RestError"
import type {U2fRegisteredDevice} from "../api/entities/sys/U2fRegisteredDevice"
import {createU2fRegisteredDevice} from "../api/entities/sys/U2fRegisteredDevice"
import type {U2fResponseData} from "../api/entities/sys/U2fResponseData"
import {createU2fResponseData} from "../api/entities/sys/U2fResponseData"
// $FlowIgnore[untyped-import]
import u2fApi from "./u2f-api"
import {SECOND_MS} from "../api/common/TutanotaConstants"
import {BrowserType} from "./ClientConstants"
import {client} from "./ClientDetector"
import type {U2fChallenge} from "../api/entities/sys/U2fChallenge"
import {delay} from "../api/common/utils/PromiseUtils"
import {downcast} from "../api/common/utils/Utils"

assertMainOrNode()

const TIMEOUT = 180

/**
 * Abstraction of the U2F high level API.
 *
 * The linked documentation provides an overview about
 * 1. the high level api and
 * 2. the raw messages sent
 *
 * @see https://fidoalliance.org/specs/fido-u2f-v1.2-ps-20170411/fido-u2f-javascript-api-v1.2-ps-20170411.html#high-level-javascript-api
 * @see https://fidoalliance.org/specs/fido-u2f-v1.1-id-20160915/fido-u2f-raw-message-formats-v1.1-id-20160915.html#registration-request-message---u2f_register
 *
 * Firefox supports u2f through the window.u2f property which we try to use when it's available.
 */
export class U2fClient {
	appId: string;

	constructor() {
		if (window.location.hostname.endsWith("tutanota.com")) {
			this.appId = "https://tutanota.com/u2f-appid.json"
		} else {
			this.appId = getHttpOrigin() + "/u2f-appid.json"
		}
	}

	/**
	 * Returns true if U2F is supported in this client. Attention: this call may take up to 1 second.
	 */
	isSupported(): Promise<boolean> {
		if (isAdminClient() || isDesktop() || isApp() || client.browser === BrowserType.EDGE) return Promise.resolve(false)
		if (window.u2f && window.u2f.register) return Promise.resolve(true)
		return this.checkVersionWithTimeout().catch(() => false)
	}

	checkVersionWithTimeout(): Promise<boolean> {
		return Promise.race([
			new Promise((resolve) => {
				console.log("u2fApi.getApiVersion")
				u2fApi.getApiVersion((responseOrError) => {
					console.log("u2fApi.getApiVersion response", responseOrError)
					resolve(responseOrError['js_api_version'] != null)
				}, 2)
			}),
			delay(SECOND_MS).then(() => false),
		])
	}

	async register(): Promise<U2fRegisteredDevice> {
		let random = new Uint8Array(32)
		let c = typeof crypto !== 'undefined' ? crypto : msCrypto
		c.getRandomValues(random)
		let challenge = base64ToBase64Url(uint8ArrayToBase64(random))

		const rawResponse = new Promise(resolve => {
			(window.u2f || u2fApi).register(this.appId, [
				{
					version: "U2F_V2",
					challenge: challenge,
				}
			], [], resolve, TIMEOUT)
		})
		const response = this._handleRawResponse(await rawResponse)
		const registerResponse = this._decodeRegisterResponse(response)
		return createU2fRegisteredDevice({
			keyHandle: registerResponse.keyHandle,
			appId: this.appId,
			publicKey: registerResponse.userPublicKey,
			compromised: false,
			counter: "-1"
		})
	}

	_handleRawResponse(rawResponse: {clientData: Base64Url, registrationData: Base64Url} | {errorCode: number}): Object {
		if (!rawResponse.errorCode) {
			return rawResponse
		} else {
			console.log("U2f error", rawResponse.errorCode, JSON.stringify(rawResponse))
			if (rawResponse.errorCode === 4) {
				throw new U2fWrongDeviceError()
			} else if (rawResponse.errorCode === 5) {
				throw new U2fTimeoutError()
			} else {
				throw new U2fError("U2f error code: " + downcast(rawResponse.errorCode))
			}
		}
	}

	async sign(sessionId: IdTuple, challenge: U2fChallenge): Promise<U2fResponseData> {
		let registeredKeys = challenge.keys.map(key => {
			return {
				version: "U2F_V2",
				keyHandle: base64ToBase64Url(uint8ArrayToBase64(key.keyHandle)),
				appId: this.appId
			}
		})
		let challengeData = base64ToBase64Url(uint8ArrayToBase64(challenge.challenge))
		const rawResponse = await new Promise(resolve => {
			(window.u2f || u2fApi).sign(this.appId, challengeData, registeredKeys, resolve, TIMEOUT)
		})
		const rawAuthenticationResponse = this._handleRawResponse(rawResponse)
		return createU2fResponseData({
			keyHandle: rawAuthenticationResponse.keyHandle,
			clientData: rawAuthenticationResponse.clientData,
			signatureData: rawAuthenticationResponse.signatureData,
		})
	}

	/**
	 * We extract the keyHandle and the public key from the u2f device and discard the attestation certificates and signature
	 * Yubikeys can be verified here: https://demo.yubico.com/u2f
	 * @param rawRegisterResponse the encoded registration response
	 * @see https://fidoalliance.org/specs/fido-u2f-v1.2-ps-20170411/fido-u2f-raw-message-formats-v1.2-ps-20170411.html#registration-response-message-success
	 */
	_decodeRegisterResponse(rawRegisterResponse: {clientData: Base64Url, registrationData: Base64Url}): {keyHandle: Uint8Array, userPublicKey: Uint8Array} {
		const msg = base64ToUint8Array(base64UrlToBase64(rawRegisterResponse.registrationData))
		const keyHandleEnd = 67 + msg[66]
		const reservedByte = msg[0]
		if (reservedByte !== REGISTRATION_RESERVED_BYTE_VALUE) {
			throw new BadRequestError("Incorrect value of reserved byte. Expected: " + REGISTRATION_RESERVED_BYTE_VALUE
				+ ". Was: " + reservedByte)
		}
		return {
			userPublicKey: msg.slice(1, 66),
			keyHandle: msg.slice(67, keyHandleEnd),
		}
	}

}

const REGISTRATION_RESERVED_BYTE_VALUE = 0x05

export class U2fTimeoutError extends TutanotaError {
	constructor() {
		super("U2fTimeoutError", "")
	}
}

export class U2fWrongDeviceError extends TutanotaError {
	constructor() {
		super("U2fWrongDeviceError", "")
	}
}

export class U2fError extends TutanotaError {
	constructor(msg: string) {
		super("U2fError", msg)
	}
}
