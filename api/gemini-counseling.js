/**
 * [보안 주석]
 * - 프론트엔드에 API 키를 넣으면 개발자 도구(Network 탭)에서 그대로 노출됩니다.
 * - Gemini API 호출은 이 Vercel Serverless Function에서만 처리합니다.
 * - .env 파일은 .gitignore에 포함하여 GitHub에 절대 올리지 않습니다.
 * - Vercel 배포 시에는 Project Settings → Environment Variables에 GEMINI_API_KEY를 등록해야 합니다.
 * - Gemini로 전송하는 데이터는 이름, 학번, 사진 경로, 비밀번호를 제외한 최소 정보로 제한합니다.
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST 요청만 허용됩니다." });
  }

  // 환경 변수 확인
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ success: false, error: "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다." });
  }

  const { studentAlias, gradeSummary, learningTraits, teacherConcern } = req.body || {};

  // 필수 값 검증
  if (!studentAlias || !gradeSummary || !learningTraits || !teacherConcern) {
    return res.status(400).json({
      success: false,
      error: "studentAlias, gradeSummary, learningTraits, teacherConcern 모두 필요합니다.",
    });
  }

  // Gemini에게 보낼 프롬프트 구성
  const prompt = `당신은 중·고등학교 교사를 돕는 학생 상담 전략 도우미입니다.
아래 학생 정보(익명화됨)와 교사의 상담 고민을 바탕으로 실질적인 상담 전략을 제안해주세요.

[중요 원칙]
- 학생을 단정적으로 판단하거나 진단하지 마세요.
- "의지가 부족하다", "주의력 문제가 있다", "심리적 문제가 있다"처럼 단정하는 표현을 피해주세요.
- 교사가 학생을 이해하고 대화할 수 있도록 돕는 방향으로 응답해주세요.
- 상담 전략은 참고용이며, 최종 판단은 교사가 학생의 상황을 종합적으로 고려하여 진행한다는 점을 응답에 포함해주세요.

[학생 정보 (익명)]
- 학생 별칭: ${studentAlias}
- 성적 요약: ${gradeSummary}
- 학습 특성: ${learningTraits}

[교사 상담 고민]
${teacherConcern}

[응답 형식 - 반드시 아래 6개 항목을 순서대로 작성해주세요]

1. 현재 상황 요약
2. 학생 데이터 기반 해석
3. 상담 접근 전략
4. 교사가 던질 수 있는 질문 3가지
5. 피해야 할 말 또는 주의점
6. 다음 수업에서 해볼 수 있는 작은 지원`;

  try {
    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API 오류:", geminiRes.status, errBody);
      return res.status(502).json({
        success: false,
        error: `Gemini API 오류 (${geminiRes.status}): ${errBody}`,
      });
    }

    const data = await geminiRes.json();
    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "응답을 파싱할 수 없습니다.";

    return res.status(200).json({ success: true, result: resultText });
  } catch (err) {
    console.error("서버리스 함수 오류:", err);
    return res.status(500).json({ success: false, error: err.message || "서버 내부 오류" });
  }
}
