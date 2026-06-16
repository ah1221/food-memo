// Gemini API を使って食べ物の「期間・値段・場所」を調べる Vercel 関数
// POST /api/lookup
// body: { name: "メニュー名" }
// response: { period, price, location } または { error }

export default async function handler(req, res) {
  // POST だけ受け付ける
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています' });
    return;
  }

  // リクエストボディから料理名を取り出す
  const body = req.body || {};
  const name = (body.name || '').toString().trim();
  if (!name) {
    res.status(400).json({ error: '料理名が指定されていません' });
    return;
  }

  // 環境変数からAPIキーを取り出す
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY が未設定です。Vercel の環境変数に追加してください。'
    });
    return;
  }

  // AI への指示文：Google検索結果から事実ベースで答えてもらう
  const prompt = `「${name}」というメニュー・商品について、Web検索結果を参考に最新の情報を調べて、
以下の3項目を必ず日本語のJSON形式だけで答えてください。前後の説明文や\`\`\`は一切不要です。

- period: 販売期間（例：「2026年6月30日まで」「通年販売」「不明」）
- price: 値段（例：「税込1,200円」「不明」）
- location: 買える場所（例：「セブンイレブン全店」「スターバックス国内店舗」「不明」）

期間限定スイーツ、コンビニ商品、レストラン期間限定メニューを想定しています。
推測ではなく検索結果から判断し、自信がないものは「不明」と返してください。

出力例：
{"period":"2026年6月30日まで","price":"税込1,200円","location":"スターバックス国内店舗"}`;

  // Gemini API (2.5 Flash + Google検索ツール) を叩く
  const modelId = 'gemini-2.5-flash';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // 最新情報を得るために Google 検索ツールを有効化
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      res.status(502).json({
        error: 'Gemini API がエラーを返しました',
        detail: detail.slice(0, 500)
      });
      return;
    }

    const data = await geminiRes.json();
    // 応答テキストを取り出す
    const text = data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      res.status(502).json({ error: 'AI から有効な応答が得られませんでした' });
      return;
    }

    // ```json ... ``` で囲まれてくる場合があるので除去してからJSONパース
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // パースに失敗したらテキストをそのまま返してフロント側で確認できるようにする
      res.status(200).json({
        period: '',
        price: '',
        location: '',
        rawText: text,
        warning: 'JSONとして解析できませんでした'
      });
      return;
    }

    // 必要なキーだけ取り出して返す
    res.status(200).json({
      period: typeof parsed.period === 'string' ? parsed.period : '',
      price: typeof parsed.price === 'string' ? parsed.price : '',
      location: typeof parsed.location === 'string' ? parsed.location : ''
    });
  } catch (error) {
    res.status(500).json({
      error: '内部エラー',
      detail: error.message
    });
  }
}
