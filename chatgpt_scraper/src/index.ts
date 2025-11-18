import 'dotenv/config';
import { ChatgptService, QueryChatgptRequest } from './chatgpt';

async function main() {
  console.log('chatgpt_scraper starting');

  const service = new ChatgptService();

  const input: QueryChatgptRequest = {
    // required by BaseInput
    task_id: 'local-test-001',
    proxy_url: '',

    // timeout in ms
    timeout: 120000,

    // required by QueryChatgptRequest
    prompt: 'Hello, this is a test run. Please return a short acknowledgement.',
    // optional (you may adjust)
    session_name: 'Local Test Session',
    web_search: true,
    session_recording: false,
    answer_type: 'text',
  };

  const start = Date.now();

  // checkTimeout should return true when we want to abort due to timeout
  const checkTimeout = () => {
    return Date.now() - start > input.timeout;
  };

  try {
    const result = await service.solver(input, checkTimeout);
    console.log('Solver result:', JSON.stringify(result, null, 2));
    console.log('chatgpt_scraper finished');
  } catch (err) {
    console.error('chatgpt_scraper error:', err);
    process.exitCode = 1;
  }
}

main();
