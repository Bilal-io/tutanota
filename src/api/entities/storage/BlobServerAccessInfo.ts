import {create} from "../../common/utils/EntityUtils.js"
import {TypeRef, downcast} from "@tutao/tutanota-utils"
import type {TypeModel} from "../../common/EntityTypes.js"

import type {BlobServerUrl} from "./BlobServerUrl.js"

export const BlobServerAccessInfoTypeRef: TypeRef<BlobServerAccessInfo> = new TypeRef("storage", "BlobServerAccessInfo")
export const _TypeModel: TypeModel = {
	"name": "BlobServerAccessInfo",
	"since": 4,
	"type": "AGGREGATED_TYPE",
	"id": 151,
	"rootId": "B3N0b3JhZ2UAAJc",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_id": {
			"id": 152,
			"type": "CustomId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		},
		"blobAccessToken": {
			"id": 153,
			"type": "String",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		}
	},
	"associations": {
		"servers": {
			"id": 154,
			"type": "AGGREGATION",
			"cardinality": "Any",
			"final": false,
			"refType": "BlobServerUrl",
			"dependency": null
		}
	},
	"app": "storage",
	"version": "4"
}

export function createBlobServerAccessInfo(values?: Partial<BlobServerAccessInfo>): BlobServerAccessInfo {
	return Object.assign(create(_TypeModel, BlobServerAccessInfoTypeRef), downcast<BlobServerAccessInfo>(values))
}

export type BlobServerAccessInfo = {
	_type: TypeRef<BlobServerAccessInfo>;

	_id: Id;
	blobAccessToken: string;

	servers: BlobServerUrl[];
}