import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { env } from 'process';
import { fileURLToPath } from 'url';
import { transcribeVideo } from './whisper-service.js';
import { analyzeTranscript, analyzeTranscriptStream, generateChapterVTT } from './ai-service.js';
import { convertToHLS } from './hls-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, value] = trimmed.split('=', 2);
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }
  }
  console.log(`[INFO] 已加载环境变量文件: ${envPath}`);
}

const app = express();
const PORT = env.PORT || 3000;

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
];

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'videos');

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
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

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload/video', upload.single('video'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const fileId = path.basename(file.filename, path.extname(file.filename));

    // 创建目录结构
    const baseDir = path.join(__dirname, 'uploads', 'videos', 'transcription', fileId);
    const videoDir = path.join(baseDir, 'video');
    const audioDir = path.join(baseDir, 'audio');
    const subtitleDir = path.join(baseDir, 'subtitle');
    const chapterDir = path.join(baseDir, 'chapter');

    // 创建所有子文件夹
    ensureDirectoryExists(baseDir);
    ensureDirectoryExists(videoDir);
    ensureDirectoryExists(audioDir);
    ensureDirectoryExists(subtitleDir);
    ensureDirectoryExists(chapterDir);

    // 将视频文件移动到 video/ 目录
    const videoPath = path.join(UPLOAD_DIR, file.filename);
    const newVideoPath = path.join(videoDir, `${fileId}${path.extname(file.filename)}`);
    fs.renameSync(videoPath, newVideoPath);

    log(`=== 视频上传开始 ===`);
    log(`视频文件: ${file.originalname}`);
    log(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    log(`文件ID: ${fileId}`);
    log(`保存路径: ${newVideoPath}`);

    // 语音识别
    log(`--- 步骤1: 语音识别 ---`);
    let transcript = '';
    try {
      transcript = await transcribeVideo(newVideoPath, subtitleDir);
      log(`语音识别成功，字幕长度: ${transcript.length} 字符`);
      log(`字幕VTT已保存到: ${subtitleDir}`);
    } catch (error) {
      log(`语音识别失败: ${error.message}`);
      transcript = '语音识别失败';
    }

    const response = {
      success: true,
      fileId: fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/${file.filename}`,
      transcript: transcript
    };

    log(`=== 视频上传完成 ===`);
    log(`返回字段: fileId, vttPath, transcript`);
    log(`章节VTT将在前端获取视频真实时长后生成`);

    res.json(response);
  } catch (error) {
    log(`上传错误: ${error.message}`);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 获取视频时长（秒）
 */
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let duration = '';
    ffprobe.stdout.on('data', (data) => {
      duration += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const parsed = parseFloat(duration.trim());
        resolve(isNaN(parsed) ? 180 : parsed);
      } else {
        reject(new Error('ffprobe failed'));
      }
    });

    ffprobe.on('error', (err) => {
      reject(err);
    });
  });
}

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      log('文件过大，超出限制');
      return res.status(413).json({
        success: false,
        error: '文件过大，最大支持500MB'
      });
    }
  } else if (error.message.includes('文件类型不合法')) {
    log(`文件类型错误: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  log(`未知错误: ${error.message}`);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  log(`服务器运行在 http://localhost:${PORT}`);
  log(`上传目录: ${UPLOAD_DIR}`);
  log(`静态文件目录: ${path.join(__dirname, 'uploads')}`);
  log('支持的视频格式: MP4, WebM, MOV');
  log('已集成 Whisper 语音识别');
});
