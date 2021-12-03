package de.tutao.tutanota.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity
data class KeyValue(
	@field:PrimaryKey val key: String,
	val value: String?
)