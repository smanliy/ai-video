const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
];

const UPLOAD_DIR = path.join('/tmp', 'uploads', 'videos');

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDirectoryExists(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('文件类型不合法，仅支持 MP4、WebM、MOV 格式'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  upload.single('video')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ success: false, error: '文件过大，最大支持500MB' });
        } else {
          res.status(400).json({ success: false, error: err.message });
        }
      } else if (err.message.includes('文件类型不合法')) {
        res.status(400).json({ success: false, error: err.message });
      } else {
        res.status(500).json({ success: false, error: '服务器内部错误' });
      }
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
      return;
    }

    const fileId = path.basename(file.filename, path.extname(file.filename));

    const response = {
      success: true,
      fileId: fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/${file.filename}`,
      vttPath: `/uploads/videos/${fileId}.vtt`,
      transcript: '这是模拟的视频转录文本...',
      hls: null
    };

    res.json(response);
  });
};
