import { env } from 'node:process';
import OpenAI from "openai";

/**
 * 同步版本：分析视频字幕并返回结果
 * @param {string} transcript - 视频转录文本
 * @param {number} duration - 视频时长（秒）
 * @returns {Object} 包含总结和分段的分析结果
 */
export const analyzeTranscript = async (transcript, duration) => {
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    console.log('\n=== [AI分析] 开始 ===');
    console.log(`[AI分析] 字幕长度: ${transcript.length} 字符`);
    console.log(`[AI分析] 视频时长: ${duration} 秒`);

    if (!apiKey || apiKey.trim() === '') {
        console.log('[AI分析] 未配置 VITE_DEEPSEEK_API_KEY，使用模拟数据');

    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    const prompt = buildPrompt(transcript, duration);

    try {
        const requestParams = {
            model: "deepseek-chat",
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        };
        console.log('[AI分析] 发送请求到大模型:');
        console.log(`  model: ${requestParams.model}`);
        console.log(`  temperature: ${requestParams.temperature}`);
        console.log(`  prompt长度: ${prompt.length} 字符`);

        console.log('[AI分析] 正在等待大模型响应...');
        const completion = await openai.chat.completions.create(requestParams);

        let content = completion.choices[0].message.content;

        console.log('[AI分析] 大模型返回内容:');
        console.log(`  原始响应长度: ${content.length} 字符`);

        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        const result = JSON.parse(content);

        console.log('[AI分析] 解析完成，分析结果:');
        console.log(`  总结: ${result.summary.substring(0, 100)}...`);
        console.log(`  分段数量: ${result.segments?.length || 0}`);
        if (result.segments && Array.isArray(result.segments)) {
            result.segments.forEach((seg, idx) => {
                console.log(`  章节 ${idx + 1}: "${seg.title}"`);
                console.log(`    时间范围: ${seg.startTime}s - ${seg.endTime}s`);
                console.log(`    描述: ${seg.description.substring(0, 50)}...`);
            });
        }
        console.log('[AI分析] 结束 ===\n');

        return result;
    } catch (error) {
        console.error('[AI分析] 失败:', error.message);
        throw error;
    }
};

/**
 * 流式版本：分析视频字幕并通过流返回结果
 * @param {string} transcript - 视频转录文本
 * @returns {ReadableStream} 流式响应
 */
export const analyzeTranscriptStream = async (transcript) => {
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    console.log('[AI分析] 流式分析开始');

    if (!apiKey || apiKey.trim() === '') {
        console.log('[AI分析] 未配置 VITE_DEEPSEEK_API_KEY，使用模拟流式数据');
        return generateMockStream(transcript);
    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    const prompt = buildPrompt(transcript, 180);

    try {
        const requestParams = {
            model: "deepseek-chat",
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            stream: true
        };
        console.log('[AI分析] 流式请求参数已准备');

        const stream = await openai.chat.completions.create(requestParams);
        return createProcessedStream(stream);
    } catch (error) {
        console.error('[AI分析] 流式分析失败:', error);
        throw error;
    }
};

/**
 * 构建提示词模板
 * @param {string} transcript - 视频转录文本
 * @param {number} duration - 视频时长（秒）
 * @returns {string} 完整的提示词
 */
function buildPrompt(transcript, duration) {
    return `你是一个视频内容分析专家。请分析以下视频字幕文本，完成两个任务：

视频时长：${duration} 秒

1. **内容总结**：用简洁的语言总结视频主要内容（100-200字）
2. **视频分段**：根据内容主题变化，将视频分成若干段落，每段包含：
   - 主题标题
   - 开始时间（秒数）
   - 结束时间（秒数）
   - 该段落的简要描述（50-100字）

字幕内容：
${transcript}

请以 JSON 格式返回结果：
{
  "summary": "视频总结内容",
  "segments": [
    {
      "title": "段落标题",
      "startTime": 0,
      "endTime": 30,
      "description": "段落描述"
    }
  ]
}

注意：
- 时间以秒为单位，必须是数字
- 分段数量根据内容长度决定，建议3-6段
- 确保时间段连续且不重叠
- 最后一段的endTime应等于视频总时长,确保总结全视频覆盖`;
}

/**
 * 处理原始流式响应，清理 Markdown 代码块标记
 */
function createProcessedStream(stream) {
    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const encoder = new TextEncoder();
                    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                        const content = chunk.choices[0].delta.content || '';
                        let cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        controller.enqueue(encoder.encode(cleanedContent));
                    }
                }
                controller.close();
            } catch (error) {
                console.error('[AI分析] 流读取错误:', error);
                controller.error(error);
            }
        }
    });
    return readableStream;
}

/**
 * 生成模拟流式响应
 */
function generateMockStream(transcript) {
    const mockResult = generateMockResult(transcript, 180);
    const jsonString = JSON.stringify(mockResult);

    let index = 0;
    return new ReadableStream({
        start(controller) {
            const interval = setInterval(() => {
                if (index < jsonString.length) {
                    const chunk = jsonString.substring(index, index + 10);
                    controller.enqueue(new TextEncoder().encode(chunk));
                    index += 10;
                } else {
                    clearInterval(interval);
                    controller.close();
                }
            }, 50);
        },
        cancel() { }
    });
}

/**
 * 生成模拟分析结果
 */
const generateMockResult = (transcript, duration) => {
    const segmentCount = Math.min(Math.ceil(transcript.length / 50), 5);
    const actualDuration = duration || 180;
    const avgDuration = Math.max(Math.floor(actualDuration / segmentCount), 30);

    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const startTime = i * avgDuration;
        const endTime = Math.min((i + 1) * avgDuration, actualDuration);
        segments.push({
            title: `段落 ${i + 1}: 视频内容概述`,
            startTime: startTime,
            endTime: endTime,
            description: `这是视频的第 ${i + 1} 段内容，包含语音识别的字幕信息。`
        });
    }

    return {
        summary: `视频内容总结：该视频包含语音识别字幕，主要讲述了"${transcript.substring(0, 50)}..."等内容。视频被分成${segmentCount}个段落进行分析。`,
        segments: segments
    };
};

/**
 * 聊天流式版本
 */
export const chatWithHistoryStream = async (messages) => {
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.log('[AI聊天] 未配置 VITE_DEEPSEEK_API_KEY，使用模拟聊天回复');
        return generateMockChatStream(messages);
    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    try {
        const requestParams = {
            model: "deepseek-chat",
            messages: messages,
            temperature: 0.7,
            stream: true
        };
        console.log('[AI聊天] 请求已发送，消息数量:', messages.length);

        const stream = await openai.chat.completions.create(requestParams);
        return createProcessedStream(stream);
    } catch (error) {
        console.error('[AI聊天] 失败:', error);
        throw error;
    }
};

/**
 * 聊天非流式版本 - 用于总结等需要完整响应的场景
 */
export const chatWithHistory = async (messages) => {
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.log('[AI聊天] 未配置 VITE_DEEPSEEK_API_KEY，使用模拟回复');
        const userMessage = messages[messages.length - 1];
        const userContent = userMessage?.content || '';

        if (userContent.includes('总结')) {
            return "这是一个模拟总结回复。由于未配置 API Key，无法调用真实的 AI 服务。在实际应用中，这里会返回由 AI 生成的对话总结。";
        }
        return `收到您的问题："${userContent}"\n\n这是一个模拟回复。`;
    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    try {
        const requestParams = {
            model: "deepseek-chat",
            messages: messages,
            temperature: 0.7,
            stream: false
        };
        console.log('[AI聊天] 请求已发送（非流式），消息数量:', messages.length);

        const response = await openai.chat.completions.create(requestParams);
        return response.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('[AI聊天] 失败:', error);
        throw error;
    }
};

/**
 * 生成模拟聊天流式响应
 */
function generateMockChatStream(messages) {
    const userMessage = messages[messages.length - 1];
    const userContent = userMessage?.content || '';

    if (userContent.includes('分析') || userContent.includes('分段') || userContent.includes('总结')) {
        const mockAnalysis = {
            summary: "该视频字幕内容呈现一段充满情感和诗意的独白，表达了对某人的思念与期待。",
            segments: [
                { title: "开场告别与情感铺垫", startTime: 0, endTime: 15, description: "以'谢谢'开场，表达告别与承诺。" },
                { title: "重复的渴望与呼唤", startTime: 15, endTime: 35, description: "连续重复强调对对方关注的渴望。" },
                { title: "转折与内心独白", startTime: 35, endTime: 50, description: "表达内心深处的坚守和希望。" },
                { title: "结尾的奉献与告别", startTime: 50, endTime: 60, description: "最后以'花是给你的'结尾。" }
            ]
        };
        return generateMockStreamFromData(mockAnalysis);
    }

    const mockReply = `收到您的问题："${userContent}"\n\n这是一个模拟回复。`;

    let index = 0;
    return new ReadableStream({
        start(controller) {
            const interval = setInterval(() => {
                if (index < mockReply.length) {
                    const chunk = mockReply.substring(index, index + 5);
                    controller.enqueue(new TextEncoder().encode(chunk));
                    index += 5;
                } else {
                    clearInterval(interval);
                    controller.close();
                }
            }, 30);
        }
    });
}

/**
 * 根据分析数据生成模拟流式响应
 */
function generateMockStreamFromData(data) {
    const jsonString = JSON.stringify(data);
    let index = 0;

    return new ReadableStream({
        start(controller) {
            const interval = setInterval(() => {
                if (index < jsonString.length) {
                    const chunk = jsonString.substring(index, index + 10);
                    controller.enqueue(new TextEncoder().encode(chunk));
                    index += 10;
                } else {
                    clearInterval(interval);
                    controller.close();
                }
            }, 30);
        }
    });
}

/**
 * 将秒数转换为 VTT 时间格式 (HH:MM:SS.mmm)
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * 根据分析结果生成章节 VTT 内容
 * @param {Object} analysisResult - 大模型返回的分析结果
 * @returns {string} VTT 格式的章节内容
 */
export function generateChapterVTT(analysisResult) {
    console.log('\n!!!!!!!!!=== [章节VTT] 生成开始 ===');

    if (!analysisResult || !analysisResult.segments || !Array.isArray(analysisResult.segments)) {
        console.error('[章节VTT] 无效的分析结果数据');
        throw new Error('无效的分析结果数据');
    }

    console.log(`[章节VTT] 处理 ${analysisResult.segments.length} 个章节`);

    let vttContent = 'WEBVTT\n\n';

    analysisResult.segments.forEach((segment, index) => {
        const startTime = formatTime(segment.startTime || 0);
        const endTime = formatTime(segment.endTime || 0);
        const title = segment.title || `章节 ${index + 1}`;

        vttContent += `${startTime} --> ${endTime}\n${title}\n\n`;
        console.log(`[章节VTT] 章节 ${index + 1}: "${title}" ${startTime} - ${endTime}`);
    });

    console.log(`[章节VTT] VTT内容长度: ${vttContent.length} 字符`);
    console.log('[章节VTT] 生成完成 ===\n');

    return vttContent.trim();
}