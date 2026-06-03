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

// 鍔犺浇 .env 鏂囦欢
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
  console.log(`[INFO] 宸插姞杞界幆澧冨彉閲忔枃浠? ${envPath}`);
}

// 鍔犺浇 .env.local 鏂囦欢锛堜紭鍏堢骇鏇撮珮锛?
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
  console.log(`[INFO] 宸插姞杞界幆澧冨彉閲忔枃浠? ${envLocalPath}`);
}

const app = express();
const PORT = env.PORT || 3000;

// 瀛樺偍 WebSocket 杩炴帴锛坒ileId -> ws锛?
const wsConnections = new Map();

// 鍒涘缓 HTTP 鏈嶅姟鍣?
const server = createServer(app);

// 鍒涘缓 WebSocket 鏈嶅姟鍣?
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  log('WebSocket 瀹㈡埛绔凡杩炴帴');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'register' && data.fileId) {
        wsConnections.set(data.fileId, ws);
        log(`WebSocket 宸叉敞鍐?fileId: ${data.fileId}`);

        // 璁剧疆杩炴帴鍏抽棴鏃舵竻鐞?
        ws.on('close', () => {
          wsConnections.delete(data.fileId);
          log(`WebSocket 杩炴帴宸叉柇寮€锛宖ileId: ${data.fileId}`);
        });
      }
    } catch (error) {
      log(`WebSocket 娑堟伅瑙ｆ瀽閿欒: ${error.message}`);
    }
  });

  ws.on('error', (error) => {
    log(`WebSocket 閿欒: ${error.message}`);
  });

  ws.on('close', () => {
    log('WebSocket 瀹㈡埛绔凡鏂紑杩炴帴');
  });
});

// 鍙戦€佽繘搴︽秷鎭?
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
    log(`[杩涘害鎺ㄩ€乚 ${fileId}: ${phase} - ${percentage}%`);
  }
};

const sendProcessingResult = (fileId, result) => {
  const ws = wsConnections.get(fileId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      fileId,
      phase: 'done',
      percentage: 100,
      message: 'processing complete',
      result
    }));
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
    cb(new Error('鏂囦欢绫诲瀷涓嶅悎娉曪紝浠呮敮鎸?MP4銆乄ebM銆丮OV 鏍煎紡'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

const processUploadedVideo = async ({ fileId, file, newVideoPath, baseDir, subtitleDir }) => {
  try {
    sendProgress(fileId, 'transcoding', 40, 'processing started');

    const [transcript, hlsData] = await Promise.all([
      transcribeVideo(newVideoPath, subtitleDir)
        .then(result => {
          sendProgress(fileId, 'transcribing', 65, 'transcription complete');
          return result;
        })
        .catch(err => {
          log(`transcription failed: ${err.message}`);
          return 'transcription failed';
        }),

      convertToHLS(newVideoPath, baseDir)
        .then(result => {
          sendProgress(fileId, 'transcoding', 55, 'HLS complete');
          return result;
        })
        .catch(err => {
          log(`HLS failed: ${err.message}`);
          return null;
        })
    ]);

    sendProgress(fileId, 'analyzing', 85, 'analyzing content');

    const result = {
      success: true,
      fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/transcription/${fileId}/video/${fileId}${path.extname(file.filename)}`,
      vttPath: `/uploads/videos/transcription/${fileId}/subtitle/${fileId}.vtt`,
      transcript,
      hls: hlsData ? {
        masterPlaylistUrl: hlsData.masterPlaylistUrl,
        streams: hlsData.streams
      } : null
    };

    sendProcessingResult(fileId, result);
  } catch (error) {
    log(`background processing failed: ${error.message}`);
    sendProgress(fileId, 'error', 100, error.message);
  }
};

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload/video', upload.single('video'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No video file selected'
      });
    }

    const fileId = path.basename(file.filename, path.extname(file.filename));
    const baseDir = path.join(__dirname, 'uploads', 'videos', 'transcription', fileId);
    const videoDir = path.join(baseDir, 'video');
    const audioDir = path.join(baseDir, 'audio');
    const subtitleDir = path.join(baseDir, 'subtitle');
    const chapterDir = path.join(baseDir, 'chapter');

    ensureDirectoryExists(baseDir);
    ensureDirectoryExists(videoDir);
    ensureDirectoryExists(audioDir);
    ensureDirectoryExists(subtitleDir);
    ensureDirectoryExists(chapterDir);

    const videoPath = path.join(UPLOAD_DIR, file.filename);
    const newVideoPath = path.join(videoDir, `${fileId}${path.extname(file.filename)}`);
    fs.renameSync(videoPath, newVideoPath);

    log(`Upload accepted: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB), fileId=${fileId}`);

    const response = {
      success: true,
      processing: true,
      fileId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/videos/transcription/${fileId}/video/${fileId}${path.extname(file.filename)}`,
      vttPath: `/uploads/videos/transcription/${fileId}/subtitle/${fileId}.vtt`,
      transcript: '',
      hls: null
    };

    res.json(response);

    setImmediate(() => {
      processUploadedVideo({ fileId, file, newVideoPath, baseDir, subtitleDir });
    });
  } catch (error) {
    log(`Upload error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get video duration in seconds.
 */async function getVideoDuration(videoPath) {
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
      log('Uploaded file is too large');
      return res.status(413).json({
        success: false,
        error: 'File is too large. Maximum size is 500MB.'
      });
    }
  } else if (error.message.includes('Invalid file type')) {
    log(`Invalid file type: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  log(`鏈煡閿欒: ${error.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * 鍒嗘瀽瑙嗛瀛楀箷锛堟祦寮忥級
 */
app.post('/api/analyze/stream', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: '缂哄皯 transcript 鍙傛暟' });
    }

    log(`[API] 鎺ユ敹鍒拌棰戝垎鏋愯姹傦紝瀛楀箷闀垮害: ${transcript.length}`);

    const webStream = await analyzeTranscriptStream(transcript);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 灏?Web Stream 杞崲涓?Node.js Stream 骞剁閬撳埌鍝嶅簲
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);
  } catch (error) {
    log(`[API] 鍒嗘瀽瑙嗛澶辫触: ${error.message}`);
    res.status(500).json({ error: '鍒嗘瀽澶辫触' });
  }
});

/**
 * 鐢熸垚绔犺妭VTT
 */
app.post('/api/generate-chapters', async (req, res) => {
  try {
    const { fileId, transcript, duration } = req.body;

    if (!fileId || !transcript) {
      return res.status(400).json({ error: '缂哄皯蹇呰鍙傛暟' });
    }

    log(`[API] 鎺ユ敹鍒扮珷鑺傜敓鎴愯姹傦紝fileId: ${fileId}, 鏃堕暱: ${duration}s`);

    // 鍒涘缓绔犺妭鐩綍
    const chapterDir = path.join(__dirname, 'uploads', 'videos', 'transcription', fileId, 'chapter');
    ensureDirectoryExists(chapterDir);

    // 鍒嗘瀽瀛楀箷骞剁敓鎴愮珷鑺?
    const analysisResult = await analyzeTranscript(transcript, duration);
    const vttContent = generateChapterVTT(analysisResult);

    // 淇濆瓨VTT鏂囦欢
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
    log(`[API] 鐢熸垚绔犺妭澶辫触: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 鑱婂ぉAPI
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { question, transcript, messages } = req.body;

    if (!question) {
      return res.status(400).json({ error: '缂哄皯 question 鍙傛暟' });
    }

    log(`[API] 鎺ユ敹鍒拌亰澶╄姹? ${question.substring(0, 30)}...`);

    // 鏋勫缓娑堟伅鍘嗗彶
    const chatMessages = [];

    // 娣诲姞绯荤粺鎻愮ず
    chatMessages.push({
      role: 'system',
      content: '浣犳槸涓€涓棰戝唴瀹瑰垎鏋愬姪鎵嬶紝鎿呴暱鍒嗘瀽瑙嗛瀛楀箷鍐呭骞跺洖绛旂浉鍏抽棶棰樸€?
    });

    // 娣诲姞鍘嗗彶娑堟伅
    if (messages && Array.isArray(messages)) {
      messages.forEach(msg => {
        chatMessages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // 娣诲姞褰撳墠闂锛堝寘鍚瓧骞曚笂涓嬫枃锛?
    const userContent = transcript
      ? `瑙嗛瀛楀箷鍐呭锛歕n${transcript}\n\n闂锛?{question}`
      : question;

    chatMessages.push({
      role: 'user',
      content: userContent
    });

    const webStream = await chatWithHistoryStream(chatMessages);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 灏?Web Stream 杞崲涓?Node.js Stream 骞剁閬撳埌鍝嶅簲
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);
  } catch (error) {
    log(`[API] 鑱婂ぉ璇锋眰澶辫触: ${error.message}`);
    res.status(500).json({ error: '鑱婂ぉ澶辫触' });
  }
});

/**
 * 鎬荤粨API - 鏍规嵁瀵硅瘽鍘嗗彶鐢熸垚鎬荤粨锛堟祦寮忚緭鍑猴級
 */
app.post('/api/summarize', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: '缂哄皯 messages 鍙傛暟鎴栨牸寮忎笉姝ｇ‘' });
    }

    log(`[API] 鎺ユ敹鍒版€荤粨璇锋眰锛屾秷鎭暟閲? ${messages.length}`);

    // 鏋勫缓鎬荤粨鎻愮ず
    const chatMessages = [];

    // 娣诲姞绯荤粺鎻愮ず
    chatMessages.push({
      role: 'system',
      content: '浣犳槸涓€涓笓涓氱殑鎬荤粨鍔╂墜锛岃瀵逛互涓嬪璇濆唴瀹硅繘琛岀畝鏄庢壖瑕佺殑鎬荤粨銆傛€荤粨闇€瑕佸寘鍚細1) 涓昏璁ㄨ鐨勪富棰橈紱2) 鍏抽敭瑕佺偣锛?) 寰楀嚭鐨勭粨璁烘垨寤鸿銆傝浣跨敤涓枃锛屼繚鎸佺畝娲佹竻鏅般€?
    });

    // 灏嗘秷鎭巻鍙茶浆鎹负鏂囨湰
    const conversationText = messages.map(msg => {
      const role = msg.role === 'assistant' ? '鍔╂墜' : '鐢ㄦ埛';
      return `${role}: ${msg.content}`;
    }).join('\n\n');

    // 娣诲姞鎬荤粨璇锋眰
    chatMessages.push({
      role: 'user',
      content: `璇锋€荤粨浠ヤ笅瀵硅瘽鍐呭锛歕n\n${conversationText}`
    });

    // 璋冪敤 AI 杩涜鎬荤粨锛堟祦寮忥級
    const webStream = await chatWithHistoryStream(chatMessages);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 灏?Web Stream 杞崲涓?Node.js Stream 骞剁閬撳埌鍝嶅簲
    const nodeReadable = Readable.fromWeb(webStream);
    nodeReadable.pipe(res);

    log(`[API] 鎬荤粨娴佸紡鍝嶅簲宸插彂閫乣);
  } catch (error) {
    log(`[API] 鎬荤粨璇锋眰澶辫触: ${error.message}`);
    res.status(500).json({ success: false, error: '鎬荤粨澶辫触' });
  }
});

server.listen(PORT, () => {
  log(`鏈嶅姟鍣ㄨ繍琛屽湪 http://localhost:${PORT}`);
  log(`WebSocket 鏈嶅姟鍣ㄥ凡鍚姩`);
  log(`涓婁紶鐩綍: ${UPLOAD_DIR}`);
  log(`闈欐€佹枃浠剁洰褰? ${path.join(__dirname, 'uploads')}`);
  log('鏀寔鐨勮棰戞牸寮? MP4, WebM, MOV');
  log('宸查泦鎴?Whisper 璇煶璇嗗埆');
});
