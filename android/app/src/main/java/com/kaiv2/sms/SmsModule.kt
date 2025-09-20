package com.kaiv2.sms

import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.util.*

class SmsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SmsModule"

  @ReactMethod
  fun getMessages(options: ReadableMap, promise: Promise) {
    val permission = android.Manifest.permission.READ_SMS
    if (reactContext.checkSelfPermission(permission) !=
      android.content.pm.PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "READ_SMS permission not granted")
      return
    }

    val limit = when {
      options.hasKey("limit") && !options.isNull("limit") -> options.getInt("limit")
      options.hasKey("max") && !options.isNull("max") -> options.getInt("max") // backward compat
      else -> 200
    }.coerceAtMost(1000)

    val addressSingle = if (options.hasKey("address") && !options.isNull("address")) options.getString("address") else null
    val addressesArray: List<String>? =
      if (options.hasKey("addresses") && !options.isNull("addresses")) {
        options.getArray("addresses")?.toArrayList()?.mapNotNull { it?.toString() }?.filter { it.isNotBlank() }?.takeIf { it.isNotEmpty() }
      } else null

    val bodyRegex = if (options.hasKey("bodyRegex") && !options.isNull("bodyRegex")) options.getString("bodyRegex") else null
    val excludeBodyRegex = if (options.hasKey("excludeBodyRegex") && !options.isNull("excludeBodyRegex")) options.getString("excludeBodyRegex") else null
    val since = if (options.hasKey("since") && !options.isNull("since")) options.getDouble("since").toLong() else 0L
    val until = if (options.hasKey("until") && !options.isNull("until")) options.getDouble("until").toLong() else 0L

    val box = if (options.hasKey("box") && !options.isNull("box")) options.getString("box") else "inbox"

    val uri: Uri = when (box?.lowercase(Locale.ROOT)) {
      "sent" -> Telephony.Sms.Sent.CONTENT_URI
      "draft" -> Telephony.Sms.Draft.CONTENT_URI
      else -> Telephony.Sms.Inbox.CONTENT_URI
    }

    val selectionParts = mutableListOf<String>()
    val selectionArgs = mutableListOf<String>()

    // Single address
    if (!addressSingle.isNullOrBlank()) {
      selectionParts += "address = ?"
      selectionArgs += addressSingle
    }

    // Multiple addresses
    if (addressesArray != null) {
      val placeholders = addressesArray.joinToString(",") { "?" }
      selectionParts += "address IN ($placeholders)"
      selectionArgs += addressesArray
    }

    if (since > 0) {
      selectionParts += "date >= ?"
      selectionArgs += since.toString()
    }
    if (until > 0) {
      selectionParts += "date <= ?"
      selectionArgs += until.toString()
    }

    val selection = if (selectionParts.isEmpty()) null else selectionParts.joinToString(" AND ")

    val projection = arrayOf(
      Telephony.Sms._ID,
      Telephony.Sms.ADDRESS,
      Telephony.Sms.BODY,
      Telephony.Sms.DATE,
      Telephony.Sms.TYPE,
      Telephony.Sms.READ,
      Telephony.Sms.THREAD_ID
    )

    CoroutineScope(Dispatchers.IO).launch {
      var cursor: Cursor? = null
      try {
        cursor = reactContext.contentResolver.query(
          uri,
          projection,
          selection,
          if (selectionArgs.isEmpty()) null else selectionArgs.toTypedArray(),
          "date DESC" // newest first
        )

        val result = Arguments.createArray()
        if (cursor != null && cursor.moveToFirst()) {
          var count = 0
          val idIdx = cursor.getColumnIndex(Telephony.Sms._ID)
          val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
          val bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY)
          val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
          val typeIdx = cursor.getColumnIndex(Telephony.Sms.TYPE)
          val readIdx = cursor.getColumnIndex(Telephony.Sms.READ)
          val threadIdx = cursor.getColumnIndex(Telephony.Sms.THREAD_ID)

          val includeRegex = bodyRegex?.let { runCatching { Regex(it) }.getOrNull() }
          val excludeRegex = excludeBodyRegex?.let { runCatching { Regex(it) }.getOrNull() }

          while (!cursor.isAfterLast && count < limit) {
            val body = cursor.getString(bodyIdx) ?: ""
            if (includeRegex != null && !includeRegex.containsMatchIn(body)) {
              cursor.moveToNext()
              continue
            }
            if (excludeRegex != null && excludeRegex.containsMatchIn(body)) {
              cursor.moveToNext()
              continue
            }

            val map = Arguments.createMap()
            map.putString("id", cursor.getString(idIdx))
            map.putString("threadId", cursor.getString(threadIdx))
            map.putString("address", cursor.getString(addrIdx))
            map.putString("body", body)
            map.putDouble("date", cursor.getLong(dateIdx).toDouble())
            map.putInt("type", cursor.getInt(typeIdx))
            map.putBoolean("read", cursor.getInt(readIdx) == 1)
            result.pushMap(map)
            count++
            cursor.moveToNext()
          }
        }

        withContext(Dispatchers.Main) { promise.resolve(result) }
      } catch (e: Exception) {
        withContext(Dispatchers.Main) { promise.reject("E_SMS_QUERY", e.message, e) }
      } finally {
        cursor?.close()
      }
    }
  }
}