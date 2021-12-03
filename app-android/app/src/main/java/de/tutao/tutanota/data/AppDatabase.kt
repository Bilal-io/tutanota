package de.tutao.tutanota.data

import android.content.Context
import de.tutao.tutanota.alarms.AlarmNotification
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.Room


@Database(version = 1, entities = [KeyValue::class, PushIdentifierKey::class, AlarmNotification::class, User::class])
abstract class AppDatabase : RoomDatabase() {
	abstract fun keyValueDao(): KeyValueDao?
	abstract fun userInfoDao(): UserInfoDao?
	abstract val alarmInfoDao: AlarmInfoDao?

	companion object {
		@JvmStatic
		fun getDatabase(context: Context?, allowMainThreadAccess: Boolean): AppDatabase {
			val builder = Room.databaseBuilder(context!!, AppDatabase::class.java, "tuta-db") // This is important because we access db across processes!
				.enableMultiInstanceInvalidation()
			if (allowMainThreadAccess) {
				builder.allowMainThreadQueries()
			}
			return builder.build()
		}
	}
}