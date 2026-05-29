const { env } = require('process');
const OpenAI = require('openai');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body;
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      const userMessage = messages[messages.length - 1];
      const userContent = userMessage?.content || '';
      
      if (userContent.includes('总结')) {
        res.status(200).send("这是一个模拟总结回复。由于未配置 API Key，无法调用真实的 AI 服务。在实际应用中，这里会返回由 AI 生成的对话总结。");
      } else {
        res.status(200).send(`收到您的问题："${userContent}"\n\n这是一个模拟回复。`);
      }
      return;
    }

    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });

    const requestParams = {
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,
      stream: true
    };

    const stream = await openai.chat.completions.create(requestParams);

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        const content = chunk.choices[0].delta.content || '';
        res.write(content);
      }
    }

    res.end();
  } catch (error) {
    console.error('[AI聊天] 失败:', error.message);
    
    const { messages } = req.body;
    const userMessage = messages[messages.length - 1];
    const userContent = userMessage?.content || '';
    
    res.status(200).send(`收到您的问题："${userContent}"\n\n这是一个模拟回复。`);
  }
};
