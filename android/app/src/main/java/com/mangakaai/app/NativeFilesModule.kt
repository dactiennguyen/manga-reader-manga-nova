package com.mangakaai.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/** Implements specs/NativeFiles.ts: zip/unzip, images to PDF, sharing and clipboard. */
class NativeFilesModule(reactContext: ReactApplicationContext) : NativeFilesSpec(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  override fun zip(sourceDir: String, outPath: String, promise: Promise) {
    executor.execute {
      try {
        val root = File(sourceDir)
        val out = File(outPath)
        out.parentFile?.mkdirs()
        ZipOutputStream(BufferedOutputStream(FileOutputStream(out))).use { zos ->
          root
              .walkTopDown()
              .filter { it.isFile }
              .sortedBy { it.relativeTo(root).path }
              .forEach { file ->
                val name = file.relativeTo(root).path.replace(File.separatorChar, '/')
                zos.putNextEntry(ZipEntry(name))
                file.inputStream().use { it.copyTo(zos) }
                zos.closeEntry()
              }
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_ZIP", e.message, e)
      }
    }
  }

  override fun unzip(zipPath: String, destDir: String, promise: Promise) {
    executor.execute {
      try {
        val dest = File(destDir)
        dest.mkdirs()
        val destRoot = dest.canonicalPath + File.separator
        ZipInputStream(BufferedInputStream(FileInputStream(zipPath))).use { zis ->
          var entry = zis.nextEntry
          while (entry != null) {
            val target = File(dest, entry.name)
            // Reject entries that resolve outside the destination (zip slip).
            if (!target.canonicalPath.startsWith(destRoot)) {
              throw SecurityException("Entry escapes the destination folder: ${entry.name}")
            }
            if (entry.isDirectory) {
              target.mkdirs()
            } else {
              target.parentFile?.mkdirs()
              FileOutputStream(target).use { zis.copyTo(it) }
            }
            zis.closeEntry()
            entry = zis.nextEntry
          }
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_UNZIP", e.message, e)
      }
    }
  }

  override fun imagesToPdf(
      imagePaths: ReadableArray,
      outPath: String,
      spread: Boolean,
      rtl: Boolean,
      pageWidthPt: Double,
      promise: Promise,
  ) {
    val widthPt = Math.round(pageWidthPt).toInt()
    val paths = (0 until imagePaths.size()).mapNotNull { imagePaths.getString(it) }
    executor.execute {
      val document = PdfDocument()
      try {
        // Spreads: the first page stands alone (cover), the rest are paired.
        val sheets: List<List<String>> =
            if (!spread) paths.map { listOf(it) }
            else paths.take(1).map { listOf(it) } + paths.drop(1).chunked(2)
        val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
        sheets.forEachIndexed { index, sheet ->
          val bitmaps = sheet.map { BitmapFactory.decodeFile(it) ?: throw IllegalArgumentException("Cannot decode image: $it") }
          val ratio = bitmaps[0].height.toFloat() / bitmaps[0].width.toFloat()
          val slots = if (spread && index > 0) 2 else 1
          val pageHeight = Math.round(widthPt * ratio)
          val info = PdfDocument.PageInfo.Builder(widthPt * slots, pageHeight, index + 1).create()
          val page = document.startPage(info)
          bitmaps.forEachIndexed { i, bitmap ->
            val slot = if (slots == 2 && rtl) 1 - i else i
            val left = (slot * widthPt).toFloat()
            page.canvas.drawBitmap(bitmap, null, RectF(left, 0f, left + widthPt, pageHeight.toFloat()), paint)
          }
          document.finishPage(page)
          bitmaps.forEach { it.recycle() }
        }
        val out = File(outPath)
        out.parentFile?.mkdirs()
        FileOutputStream(out).use { document.writeTo(it) }
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("E_PDF", e.message, e)
      } finally {
        document.close()
      }
    }
  }

  override fun shareFile(path: String, mimeType: String, title: String, promise: Promise) {
    try {
      val context = reactApplicationContext
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", File(path))
      val send =
          Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri(title, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
      val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context.currentActivity ?: context).startActivity(chooser)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SHARE", e.message, e)
    }
  }

  override fun copyText(text: String) {
    val clipboard = reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("Mangaka AI", text))
  }

  companion object {
    const val NAME = "NativeFiles"
  }
}
