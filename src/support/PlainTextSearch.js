// @flow

type SearchMatch = {
	// when searching, we receive the search query 'queryString'. It gets split into an array of individual queryWords.
	// example: searching for 'what are aliases'
	// => queryString = "what is an alias"
	// => queryWords = ["what", "is", "an" ,"aliases"]

	entry: any; // the input entry in which we search
	partialWordMatches: number; // how many times a queryWord was found being part of another word in the entry ; 'alias' in 'aliases'
	matchedWords: Array<string>; // all distinct queryWords that were found
	relativeMatchCount: number; // relative percent amount of how many times the word was found within the entries' text
	foundInTags: boolean; // whether one of the queryWords has been found within the tags of the entry
}

/**
 * @param queryString List of query words separated by whitespace
 * @param entries Plain text entries to search in.
 * @param attributeNames The attributes that are searched within entries. The list should be sorted by priority
 * @param markHits If set to true the hits will be marked with html tag <mark>
 * @returns a list of entries, sorted by priority, that match the query string
 */
export function search<T>(queryString: string, entries: T[], attributeNames: string[], markHits: boolean = false): T[] {
	entries = entries.map(e => Object.assign({}, e)) // create a copy in order to not override the original values
	if (queryString) {
		let matchingEntries = _search(queryString, entries, attributeNames, markHits)
		matchingEntries = matchingEntries.filter(match => match.matchedWords.length > 0)
			// a and b are two matches that refer to entries (e.g. faqs)
			// check https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort for why we are returning these values
			                             .sort((a, b) => {
				                             if (a.foundInTags && b.foundInTags && b.relativeMatchCount !== a.relativeMatchCount) {
					                             return (b.relativeMatchCount - a.relativeMatchCount)
				                             } else if (!a.foundInTags && b.foundInTags) {
					                             return 1
				                             } else if (a.foundInTags && !b.foundInTags) {
					                             return -1
				                             } else if (!a.foundInTags && !b.foundInTags) {
					                             return (b.relativeMatchCount - a.relativeMatchCount)
				                             } else {
					                             return 0
				                             }
			                             })
			                             .map(match => match.entry)
		return matchingEntries
	} else {
		return entries
	}
}

// export only for testing
export function _search(queryString: string, entries: any[], attributeNames: string[], markHits: boolean): SearchMatch[] {
	let queryWords = queryString.split(" ")
	return entries.map(entry => {
		let fullWordMatches = 0
		let partialWordMatches = 0
		let completeMatch = 0
		let foundInTags = false
		const matchedWords = []
		attributeNames.forEach((name, index) => {
			const value = entry[name]
			if (!value) {
				return
			}

			const splitValue = value.split(/(<[^>]+>)/gi) // we split the array into words that are html markup and non html markup words as we don't want to search in html tags

			// regular expression for finding all matches (including partial matches)
			let regExp = new RegExp(queryWords
					.map(queryWord => escapeRegExp(queryWord))
					.join("|"),
				"gi")

			let findResult = _findMatches(splitValue, regExp, markHits)

			if (markHits && findResult.hits > 0) {
				entry[name] = splitValue.join("")
			}
			findResult.matchedQueryWords.forEach(queryWord => {
				if (matchedWords.indexOf(queryWord) === -1) {
					matchedWords.push(queryWord)
				}
			})
			if (findResult.hits > 0) {
				partialWordMatches += findResult.hits
			}

			const tags = entry.tags.split(",")
			for (var tag of tags) {
				if (foundInTags) break
				for (var queryWord of queryWords) {
					if (!foundInTags) {
						foundInTags = tag.replace(/<[^>]*>/g, '').trim().toLowerCase().includes(queryWord.toLowerCase()) // replace() with regex to remove unwanted <mark> HTML tags
					} else {
						break
					}
				}
			}
		})

		return {
			entry,
			partialWordMatches: partialWordMatches,
			matchedWords: matchedWords,
			relativeMatchCount: (partialWordMatches / entry.text.split(" ").length) * 100, // formula to calculate relative percentage amount of matches per total amount of words
			foundInTags: foundInTags
		}
	})
}

type FindResult = {
	hits: number;
	matchedQueryWords: string[];
}

//export for testing only
export function _findMatches(splitValue: Array<string>, regExp: RegExp, markHits: boolean): FindResult {
	return splitValue.reduce((sum, value, index) => {
		if (value.trim().length === 0 || value.startsWith("<")) {
			return sum
		}
		splitValue[index] = value.replace(regExp, (match) => {
			sum.hits++
			if (sum.matchedQueryWords.indexOf(match.toLowerCase()) === -1) {
				sum.matchedQueryWords.push(match.toLowerCase())
			}
			if (markHits && match.length > 2) {
				// only mark matches that are longer than two characters.
				// We could mark these small matches but we should check that the match is a whole word then.
				return `<mark>${match}</mark>`
			} else {
				return match
			}
		})
		return sum
	}, {hits: 0, matchedQueryWords: []})
}

// see https://stackoverflow.com/a/6969486
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}