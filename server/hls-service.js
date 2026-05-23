/**
 * HLS 转码服务
 * 使用 ffmpeg 命令行工具将 MP4 视频转换为多清晰度自适应流
 * 输入：上传的 MP4 视频
 * 输出：HLS 多清晰度流（1080p、720p、480p）+ master.m3u8 播放列表
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * 清晰度配置
 * 包含 1080p、720p、480p 三个级别
 */
const QUALITY_LEVELS = [
  {
    name: '1080p',
    label: '高清 1080p',
    resolution: '1920x1080',
    videoBitrate: '5000k',
    audioBitrate: '192k'
  },
  {
    name: '720p',
    label: '超清 720p',
    resolution: '1280x720',
    videoBitrate: '2500k',
    audioBitrate: '128k'
  },
  {
    name: '480p',
    label: '标清 480p',
    resolution: '854x480',
    videoBitrate: '1000k',
    audioBitrate: '96k'
  }
];

/**
 * 将 MP4 视频转码为 HLS 多清晰度自适应流
 * @param {string} inputPath - 输入 MP4 视频文件路径
 * @param {string} baseDir - 基础输出目录（可选，默认生成新目录）
 * @returns {Promise<Object>} - 返回转码结果，包含 master.m3u8 路径和质量级别信息
 */
export const convertToHLS = async (inputPath, baseDir = null) => {
  return new Promise((resolve, reject) => {
    // 验证输入文件
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('输入文件不存在'));
    }

    const fileName = path.basename(inputPath, path.extname(inputPath));

    // 如果没有指定 baseDir，生成一个新的
    if (!baseDir) {
      const videoId = uuidv4();
      baseDir = path.join(
        process.cwd(),
        'uploads',
        'videos',
        'transcription',
        videoId
      );
    }

    // 创建基础输出目录
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`[HLS] 创建基础目录: ${baseDir}`);
    }

    const masterPlaylistPath = path.join(baseDir, 'master.m3u8');
    const streams = [];

    // console.log(`[HLS] 开始转码视频: ${fileName}`);
    // console.log(`[HLS] 输出目录: ${baseDir}`);

    // 为每个清晰度级别创建转码任务
    let completedCount = 0;

    QUALITY_LEVELS.forEach((quality) => {
      const streamName = quality.name;
      const streamOutputDir = path.join(baseDir, streamName);

      // 创建清晰度级别目录
      if (!fs.existsSync(streamOutputDir)) {
        fs.mkdirSync(streamOutputDir, { recursive: true });
      }

      const streamPlaylist = `${streamName}/playlist.m3u8`;
      const streamPath = path.join(baseDir, streamPlaylist);

      // 记录流信息用于生成 master.m3u8
      streams.push({
        quality: quality.name,
        label: quality.label,
        resolution: quality.resolution,
        playlist: streamPlaylist,
        videoBitrate: quality.videoBitrate,
        audioBitrate: quality.audioBitrate
      });

      // 构建 ffmpeg 命令参数
      // 使用 libopenh264（纯软件编码器，兼容性最好）
      const args = [
        '-i', inputPath,                    // 输入文件
        '-c:v', 'libopenh264',              // 视频编码（使用 libopenh264，兼容性最好）
        '-c:a', 'aac',                      // 音频编码
        '-preset', 'fast',                  // 编码速度/质量权衡
        '-crf', '23',                       // 恒定质量因子
        '-g', '60',                         // 关键帧间隔
        '-sc_threshold', '0',               // 场景变化检测阈值
        '-vf', `scale=${quality.resolution}`, // 分辨率缩放
        '-b:v', quality.videoBitrate,       // 视频比特率
        '-b:a', quality.audioBitrate,       // 音频比特率
        '-ac', '2',                         // 音频声道数
        '-ar', '44100',                     // 音频采样率
        '-hls_time', '10',                  // 分片时间（秒）
        '-hls_list_size', '0',              // 保留所有分片
        '-hls_segment_filename', path.join(streamOutputDir, 'segment_%03d.ts'),
        '-hls_flags', 'independent_segments', // 独立分片
        '-hls_playlist_type', 'vod',        // 点播模式
        '-f', 'hls',                        // 输出格式
        streamPath                          // 输出路径
      ];

      // console.log(`[HLS] [${quality.name}] 执行命令: ffmpeg ${args.join(' ').slice(0, 150)}...`);

      // 执行 ffmpeg 命令
      const ffmpegProcess = spawn('ffmpeg', args);

      ffmpegProcess.stderr.on('data', (data) => {
        // 仅输出关键信息，避免日志过多
        const output = data.toString().trim();
        if (output.includes('frame=') || output.includes('time=') || output.includes('speed=')) {
          // 进度信息，可选输出
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`[HLS] [${quality.name}] 转码失败，退出码: ${code}`);
          reject(new Error(`转码失败 [${quality.name}]: 退出码 ${code}`));
          return;
        }

        console.log(`[HLS] [${quality.name}] 转码完成`);
        completedCount++;

        // 所有清晰度转码完成后生成 master.m3u8
        if (completedCount === QUALITY_LEVELS.length) {
          generateMasterPlaylist(masterPlaylistPath, streams)
            .then(() => {
              // console.log(`[HLS] 转码全部完成，Master Playlist: ${masterPlaylistPath}`);
              resolve({
                baseDir,
                masterPlaylist: masterPlaylistPath,
                masterPlaylistUrl: `/uploads/videos/transcription/${path.basename(baseDir)}/master.m3u8`,
                streams
              });
            })
            .catch((err) => {
              reject(err);
            });
        }
      });

      ffmpegProcess.on('error', (err) => {
        console.error(`[HLS] [${quality.name}] 命令执行失败:`, err.message);
        reject(new Error(`转码失败 [${quality.name}]: ${err.message}`));
      });
    });
  });
};

/**
 * 生成 Master Playlist (master.m3u8)
 * @param {string} outputPath - master.m3u8 文件路径
 * @param {Array} streams - 流信息数组
 * @returns {Promise<void>}
 */
const generateMasterPlaylist = (outputPath, streams) => {
  return new Promise((resolve, reject) => {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n\n';

    streams.forEach((stream) => {
      const [width, height] = stream.resolution.split('x').map(Number);
      const bandwidth = calculateBandwidth(stream.videoBitrate, stream.audioBitrate);

      // 添加流信息
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},`;
      playlist += `RESOLUTION=${stream.resolution},`;
      playlist += `FRAME-RATE=25,`;
      playlist += `CODECS="avc1.640028,mp4a.40.2",`;
      playlist += `NAME="${stream.label}"\n`;
      playlist += `${stream.playlist}\n\n`;
    });

    fs.writeFile(outputPath, playlist, 'utf8', (err) => {
      if (err) {
        return reject(new Error(`写入 Master Playlist 失败: ${err.message}`));
      }
      // console.log(`[HLS] Master Playlist 已生成: ${outputPath}`);
      resolve();
    });
  });
};

/**
 * 计算带宽（将视频和音频比特率转换为总带宽）
 * @param {string} videoBitrate - 视频比特率（如 '5000k'）
 * @param {string} audioBitrate - 音频比特率（如 '192k'）
 * @returns {number} - 总带宽（bps）
 */
const calculateBandwidth = (videoBitrate, audioBitrate) => {
  const parseBitrate = (bitrate) => {
    const match = bitrate.match(/^(\d+)([kKmMgG])/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toUpperCase();
      switch (unit) {
        case 'K':
          return value * 1000;
        case 'M':
          return value * 1000 * 1000;
        case 'G':
          return value * 1000 * 1000 * 1000;
        default:
          return value;
      }
    }
    return parseInt(bitrate, 10) || 0;
  };

  const videoBps = parseBitrate(videoBitrate);
  const audioBps = parseBitrate(audioBitrate);

  // 增加 10% 的缓冲区
  return Math.round((videoBps + audioBps) * 1.1);
};

/**
 * 获取视频信息（时长、分辨率等）
 * @param {string} inputPath - 视频文件路径
 * @returns {Promise<Object>} - 视频信息对象
 */
export const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-show_entries', 'format=duration,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,duration,sample_rate,channels',
      '-of', 'json'
    ];

    const ffprobeProcess = spawn('ffprobe', args);
    let output = '';
    let error = '';

    ffprobeProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`获取视频信息失败: ${error}`));
      }

      try {
        const metadata = JSON.parse(output);
        const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');

        resolve({
          duration: parseFloat(metadata.format?.duration),
          bitrate: parseInt(metadata.format?.bit_rate, 10),
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            frameRate: videoStream.r_frame_rate ? eval(videoStream.r_frame_rate) : null,
            duration: parseFloat(videoStream.duration)
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels
          } : null
        });
      } catch (parseError) {
        reject(new Error(`解析视频信息失败: ${parseError.message}`));
      }
    });

    ffprobeProcess.on('error', (err) => {
      reject(new Error(`执行 ffprobe 失败: ${err.message}`));
    });
  });
};

/**
 * 删除 HLS 转码输出目录
 * @param {string} videoId - 视频 ID
 * @returns {Promise<void>}
 */
export const cleanupHLSOuput = (videoId) => {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(
      process.cwd(),
      'uploads',
      'videos',
      'transcription',
      videoId
    );

    if (!fs.existsSync(outputDir)) {
      return resolve();
    }

    fs.rm(outputDir, { recursive: true, force: true }, (err) => {
      if (err) {
        return reject(new Error(`删除目录失败: ${err.message}`));
      }
      console.log(`[HLS] 已清理目录: ${outputDir}`);
      resolve();
    });
  });
};
