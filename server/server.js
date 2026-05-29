import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { env } from 'process';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { transcribeVideo } from './whisper-service.js';
import { analyzeTranscript, analyzeTranscriptStream, generateChapterVTT, chatWithHistoryStream, chatWithHistory } from './ai-service.js';
import { convertToHLS } from './hls-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件
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

// 加载 .env.local 文件（优先级更高）
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
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
  console.log(`[INFO] 已加载环境变量文件: ${envLocalPath}`);
}

const app = express();
const PORT = env.PORT || 3000;

// 存储 WebSocket 连接（fileId -> ws）
const wsConnections = new Map();

// 创建 HTTP 服务器
const server = createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  log('WebSocket 客户端已连接');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'register' && data.fileId) {
        wsConnections.set(data.fileId, ws);
        log(`WebSocket 已注册 fileId: ${data.fileId}`);

        // 设置连接关闭时清理
        ws.on('close', () => {
          wsConnections.delete(data.fileId);
          log(`WebSocket 连接已断开，fileId: ${data.fileId}`);
        });
      }
    } catch (error) {
      log(`WebSocket 消息解析错误: ${error.message}`);
    }
  });

  ws.on('error', (error) => {
    log(`WebSocket 错误: ${error.message}`);
  });

  ws.on('close', () => {
    log('WebSocket 客户端已断开连接');
  });
});

// 发送进度消息
const sendProgress = (fileId, phase, percentage, message) => {
  const ws = wsConnections.get(fileId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const progressData = {
      fileId,
      phase,
      percentage,
      message: message || ''
    };
    ws.send(JSON.stringify(progressData));
    log(`[进度推送] ${fileId}: ${phase} - ${percentage}%`);
  }
};

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

    // 上传完成，开始服务器处理阶段
    sendProgress(fileId, 'uploading', 30, '文件上传完成，开始处理...');

    // 并发执行：语音识别 和 HLS转码
    log(`--- 并发任务开始 ---`);

    // 转码阶段
    sendProgress(fileId, 'transcoding', 40, '开始转码...');

    const [transcript, hlsData] = await Promise.all([
      // 任务1：语音识别（生成字幕）
      transcribeVideo(newVideoPath, subtitleDir)
        .then(result => {
          sendProgress(fileId, 'transcribing', 65, '语音识别完成');
          log(`语音识别成功，字幕长度: ${result.length} 字符`);
          log(`字幕VTT已保存到: ${subtitleDir}`);
          return result;
        })
        .catch(err => {
          log(`语音识别失败: ${err.message}`);
          return '语音识别失败';
        }),

      // 任务2：HLS转码（生成多清晰度流）
      convertToHLS(newVideoPath, baseDir)
        .then(result => {
          sendProgress(fileId, 'transcoding', 55, 'HLS转码完成');
          log(`HLS转码成功，生成 master.m3u8: ${result.masterPlaylistUrl}`);
          log(`清晰度级别: ${result.streams.map(s => s.quality).join(', ')}`);
          return result;
        })
        .catch(err => {
          log(`HLS转码失败: ${err.message}`);
          log(`将使用原始视频播放`);
          return null;
        })
    ]);

    log(`--- 并发任务完成 ---`);

    // 分析阶段
    sendProgress(fileId, 'analyzing', 85, '正在分析视频内容...');

    const response = {
      success: true,
      fileId: fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/transcription/${fileId}/video/${fileId}${path.extname(file.filename)}`,
      vttPath: `/uploads/videos/transcription/${fileId}/subtitle/${fileId}.vtt`,
      transcript: transcript,
      hls: hlsData ? {
        masterPlaylistUrl: hlsData.masterPlaylistUrl,
        streams: hlsData.streams
      } : null
    };

    // 完成阶段
    sendProgress(fileId, 'done', 100, '处理完成');

    log(`=== 视频上传完成 ===`);
    log(`返回字段: fileId, vttPath, transcript, hls`);
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

/**
 * 分析视频字幕（流式）
 */
app.post('/api/analyze/stream', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: '缺少 transcript 参数' });
    }

    log(`[API] 接收到视频分析请求，字幕长度: ${transcript.length}`);

    const webStream = await analyzeTranscriptStream(transcript);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 将 Web Stream 转换为 Node.js Stream 并管道到响应
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);
  } catch (error) {
    log(`[API] 分析视频失败: ${error.message}`);
    res.status(500).json({ error: '分析失败' });
  }
});

/**
 * 生成章节VTT
 */
app.post('/api/generate-chapters', async (req, res) => {
  try {
    const { fileId, transcript, duration } = req.body;

    if (!fileId || !transcript) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    log(`[API] 接收到章节生成请求，fileId: ${fileId}, 时长: ${duration}s`);

    // 创建章节目录
    const chapterDir = path.join(__dirname, 'uploads', 'videos', 'transcription', fileId, 'chapter');
    ensureDirectoryExists(chapterDir);

    // 分析字幕并生成章节
    const analysisResult = await analyzeTranscript(transcript, duration);
    const vttContent = generateChapterVTT(analysisResult);

    // 保存VTT文件
    const vttPath = path.join(chapterDir, `${fileId}_chapters.vtt`);
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    const vttUrlPath = `/uploads/videos/transcription/${fileId}/chapter/${fileId}_chapters.vtt`;

    res.json({
      success: true,
      chapterVttPath: vttUrlPath,
      summary: analysisResult.summary || '',
      segments: analysisResult.segments
    });
  } catch (error) {
    log(`[API] 生成章节失败: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 聊天API
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { question, transcript, messages } = req.body;

    if (!question) {
      return res.status(400).json({ error: '缺少 question 参数' });
    }

    log(`[API] 接收到聊天请求: ${question.substring(0, 30)}...`);

    // 构建消息历史
    const chatMessages = [];

    // 添加系统提示
    chatMessages.push({
      role: 'system',
      content: '你是一个视频内容分析助手，擅长分析视频字幕内容并回答相关问题。'
    });

    // 添加历史消息
    if (messages && Array.isArray(messages)) {
      messages.forEach(msg => {
        chatMessages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // 添加当前问题（包含字幕上下文）
    const userContent = transcript
      ? `视频字幕内容：\n${transcript}\n\n问题：${question}`
      : question;

    chatMessages.push({
      role: 'user',
      content: userContent
    });

    const webStream = await chatWithHistoryStream(chatMessages);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 将 Web Stream 转换为 Node.js Stream 并管道到响应
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);
  } catch (error) {
    log(`[API] 聊天请求失败: ${error.message}`);
    res.status(500).json({ error: '聊天失败' });
  }
});

/**
 * 总结API - 根据对话历史生成总结（流式输出）
 */
app.post('/api/summarize', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: '缺少 messages 参数或格式不正确' });
    }

    log(`[API] 接收到总结请求，消息数量: ${messages.length}`);

    // 构建总结提示
    const chatMessages = [];

    // 添加系统提示
    chatMessages.push({
      role: 'system',
      content: '你是一个专业的总结助手，请对以下对话内容进行简明扼要的总结。总结需要包含：1) 主要讨论的主题；2) 关键要点；3) 得出的结论或建议。请使用中文，保持简洁清晰。'
    });

    // 将消息历史转换为文本
    const conversationText = messages.map(msg => {
      const role = msg.role === 'assistant' ? '助手' : '用户';
      return `${role}: ${msg.content}`;
    }).join('\n\n');

    // 添加总结请求
    chatMessages.push({
      role: 'user',
      content: `请总结以下对话内容：\n\n${conversationText}`
    });

    // 调用 AI 进行总结（流式）
    const webStream = await chatWithHistoryStream(chatMessages);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 将 Web Stream 转换为 Node.js Stream 并管道到响应
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);

    log(`[API] 总结流式响应已发送`);
  } catch (error) {
    log(`[API] 总结请求失败: ${error.message}`);
    res.status(500).json({ success: false, error: '总结失败' });
  }
});

server.listen(PORT, () => {
  log(`服务器运行在 http://localhost:${PORT}`);
  log(`WebSocket 服务器已启动`);
  log(`上传目录: ${UPLOAD_DIR}`);
  log(`静态文件目录: ${path.join(__dirname, 'uploads')}`);
  log('支持的视频格式: MP4, WebM, MOV');
  log('已集成 Whisper 语音识别');
});
