export function getAiTimesSummaryPrompt(title: string, content: string): string {
  return `다음 AI 관련 뉴스 기사를 한국어로 간결하게 요약해주세요. 핵심 내용과 중요한 포인트만 포함해주세요.

제목: ${title}

본문: ${content}

요약:`;
}

/**
 * 제목만을 활용한 핵심 키워드 추출 프롬프트
 * @param title 기사 제목
 * @returns 제목 요약 프롬프트
 */
export function getTitleSummaryPrompt(title: string): string {
  return `{${title}} <- 들어갈 문장

위 문장을 아주 짧게, 핵심 위주로.
네가 출력해줄 포맷은 딱 문장만이야.`;
}

/**
 * 본문만을 활용한 3줄 요약 프롬프트
 * @param content 기사 본문
 * @returns 본문 요약 프롬프트
 */
export function getContentSummaryPrompt(content: string): string {
  return `{${content}}
위 글을 딱 3줄로만 요약해줘.
테크 업계에서 일어나는 일을 좋아하는 기술 매니아를 위한 요약이야.
문장이 너무 길지 않고 잘 읽히게, 핵심을 담아서 써줘야해.
네가 출력해줄 포맷은 1,2,3을 붙여서 3개로 요약해주면됨`;
}

/**
 * 3줄 요약의 각 줄에 대해 본문을 바탕으로 4줄 내외의 세부 설명을 생성하는 프롬프트
 * @param summaryLine 3줄 요약의 한 줄
 * @param content 기사 본문
 * @returns 세부 설명 프롬프트
 */
export function getDetailForSummaryLinePrompt(summaryLine: string, content: string): string {
  return `아래는 뉴스 기사 본문과, 그 본문을 요약한 한 문장입니다.\n\n[기사 본문]\n${content}\n\n[요약 문장]\n${summaryLine}\n\n위 요약 문장에 대해, 본문 내용을 바탕으로 4줄 이내로 구체적이고 요약적으로 세부 설명을 작성해줘.\n너의 답변은 바로 설명만 출력하면 돼.`;
}

/**
 * 기사 원문 제목과 본문 요약을 바탕으로 카테고리 태깅 프롬프트
 * @param title 기사 원문 제목
 * @param summary 본문 요약(3줄)
 * @returns 카테고리 태깅 프롬프트
 */
export function getCategoryTaggingPrompt(title: string, summary: string): string {
  return `아래는 AI 뉴스 기사 제목과 요약입니다. 이 기사가 어떤 카테고리에 속하는지 1~5 중 하나의 숫자만 골라서 답변해줘. 반드시 숫자만 출력해야 해.

[카테고리 정의]
1. 오픈소스 : 개발자들이 실제로 사용할 수 있는, 경량 모델 공개, 오픈소스 모델공개 등에 대한 것들.
2. 서비스 : 일반인이 사용할 수 있는 상용 AI 서비스에 대한 이야기. 예) Claude 신규 기능 출시, X에서 Grok4 신규 공개 등
3. 연구 : 대학원이나 기업에서 연구 수준에 그친 느낌.
4. 비즈니스 / 산업 : 정부 투자, AI 법/정책, 대기업/산업/계약/투자/시장/정책 등
5. 기타 : 위 1~4에 해당하지 않는 경우

[예시]
- 제목: "Meta, Llama 3 오픈소스 공개" / 요약: "Meta가 Llama 3 모델을 오픈소스로 공개했다." → 답: 1
- 제목: "Claude 3.5 Sonnet, 이미지 인식 기능 추가" / 요약: "Anthropic이 Claude 3.5 Sonnet에 이미지 인식 기능을 추가했다." → 답: 2
- 제목: "서울대, AI 기반 단백질 구조 예측 연구 발표" / 요약: "서울대 연구팀이 AI로 단백질 구조를 예측하는 연구를 발표했다." → 답: 3
- 제목: "유럽연합, AI 법안 최종 통과" / 요약: "EU가 AI 규제 법안을 최종 통과시켰다." → 답: 4
- 제목: "AI와 관련 없는 기타 소식" / 요약: "AI와 직접적 관련이 없는 기타 뉴스." → 답: 5

포괄적으로 생각해서 분류하지말고, 좁고 깐깐하게 1~4를 분류해줘. 1~4에 확실히 해당되지 않으면 5번이야.

[기사 제목]
${title}

[기사 요약]
${summary}

카테고리 번호(1~5)만 답변: `;
}
