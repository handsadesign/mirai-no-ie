// 第2期のクライアント補助データ（生成物・直接編集しない）
// 生成: node tools/build_v2_prompt.mjs
// プロンプト本文はB5移管（2026-11-17）でWorker側（proxy-worker.jsのV2P）へ移動し、ここには置かない（知財保護）。
const V2_PROMPTS = {
  parts: ["キッチン","クローゼット・衣類収納","ダイニング","トイレ","リビング","ワークスペース","収納・日用品と季節物","寝室","洗濯まわり","洗面","浴室","玄関"], // モジュールのある部位（部位メニュー用）
};
if (typeof module !== 'undefined') module.exports = V2_PROMPTS;
