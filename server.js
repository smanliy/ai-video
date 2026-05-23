const express = require('express')
const multer = require('multer')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3000

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
]

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'videos')

const log = (message) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log(`Created directory: ${dir}`)
  }
}

ensureDirectoryExists(UPLOAD_DIR)

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4()
    const ext = path.extname(file.originalname)
    const filename = `${fileId}${ext}`
    cb(null, filename)
  }
})

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('文件类型不合法，仅支持 MP4、WebM、MOV 格式'), false)
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
})

app.use(cors())
app.use(express.json())

app.post('/upload/video', upload.single('video'), (req, res) => {
  try {
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      })
    }

    const fileId = path.basename(file.filename, path.extname(file.filename))

    const response = {
      success: true,
      fileId: fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/${file.filename}`
    }

    log(`视频上传成功: ${file.originalname} (${file.size} bytes)`)

    res.json(response)
  } catch (error) {
    log(`上传错误: ${error.message}`)
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    })
  }
})

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      log('文件过大，超出限制')
      return res.status(413).json({
        success: false,
        error: '文件过大，最大支持500MB'
      })
    }
  } else if (error.message.includes('文件类型不合法')) {
    log(`文件类型错误: ${error.message}`)
    return res.status(400).json({
      success: false,
      error: error.message
    })
  }
  
  log(`未知错误: ${error.message}`)
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  log(`服务器运行在 http://localhost:${PORT}`)
  log(`上传目录: ${UPLOAD_DIR}`)
  log('支持的视频格式: MP4, WebM, MOV')
})
