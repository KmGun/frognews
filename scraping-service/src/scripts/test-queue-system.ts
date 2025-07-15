import { callOpenAIWithQueue, getQueueStatus } from '../utils/openai-rate-limiter';
import OpenAI from 'openai';

// OpenAI 클라이언트 생성
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testQueueSystem() {
  console.log('🧪 OpenAI API 큐 시스템 테스트 시작\n');

  try {
    // 여러 개의 동시 요청 테스트
    const testRequests = [
      { text: '인공지능이란 무엇인가?', priority: 1 },
      { text: '머신러닝의 기본 개념', priority: 2 },
      { text: '딥러닝과 신경망', priority: 3 },
      { text: '자연어처리 기술', priority: 4 },
      { text: 'GPT 모델의 발전', priority: 5 },
    ];

    console.log(`📝 ${testRequests.length}개의 테스트 요청 큐에 추가 중...\n`);

    // 모든 요청을 동시에 큐에 추가
    const promises = testRequests.map((req, index) => 
      callOpenAIWithQueue(
        async () => {
          console.log(`🔄 요청 ${index + 1} 실행 중: ${req.text}`);
          return await client.chat.completions.create({
            model: 'gpt-4.1',
            messages: [{ role: 'user', content: `${req.text}에 대해 한 줄로 간단히 설명해주세요.` }],
            max_tokens: 100,
            temperature: 0.3
          });
        },
        req.text,
        100,
        req.priority
      )
    );

    // 큐 상태 모니터링
    const statusInterval = setInterval(() => {
      const status = getQueueStatus();
      console.log(`📊 큐 상태 - 대기: ${status.queueLength}, 처리중: ${status.processing ? 'YES' : 'NO'}, 토큰: ${status.currentTokenUsage}/${Math.floor(30000 * 0.9)}`);
      
      if (status.queueLength === 0 && !status.processing) {
        clearInterval(statusInterval);
      }
    }, 1000);

    // 모든 요청 완료 대기
    const results = await Promise.all(promises);

    console.log('\n✅ 모든 요청 완료!\n');

    // 결과 출력
    results.forEach((result, index) => {
      const content = result.choices[0]?.message?.content?.trim() || '응답 없음';
      console.log(`${index + 1}. ${testRequests[index].text}`);
      console.log(`   답변: ${content}\n`);
    });

    // 최종 큐 상태
    const finalStatus = getQueueStatus();
    console.log('📊 최종 큐 상태:');
    console.log(`   - 큐 길이: ${finalStatus.queueLength}`);
    console.log(`   - 토큰 사용량: ${finalStatus.currentTokenUsage}`);
    console.log(`   - 요청 수: ${finalStatus.currentRequestCount}`);
    console.log(`   - 다음 리셋까지: ${Math.ceil(finalStatus.timeUntilReset / 1000)}초`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 환경변수 체크
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// 테스트 실행
testQueueSystem()
  .then(() => {
    console.log('🎉 큐 시스템 테스트 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 중 오류 발생:', error);
    process.exit(1);
  }); 