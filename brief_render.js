/* brief_render.js — Design Brief（ブック体裁の要望書）をブラウザで描くレンダラ。
 *
 * build_brief.py（weasyprint版）の忠実な移植。SOURCE(report) と EDITORIAL(AI生成) の
 * 二層構造をそのまま踏襲する。renderBrief(report, editorial) が完全なHTML文字列を返す。
 *
 * - report:    アプリの要望書JSON（{ sections:[{id,label,items}], generatedAt } と session履歴は別途）
 * - editorial: AIが生成したEDITORIAL層
 *   { purpose_quote, self_quote, who_lede, timeline:[[t,a]], rhythm_note,
 *     values:[{label,quote}], themes:[{jp,en,evidence[],wish[]}],
 *     rooms:[{id,essence}], statement, materials?:{keep:[],avoid:[]} }
 *
 * ブラウザ印刷では @page のマージンボックス（セクション名・ノンブル）は出ない（割り切り）。
 * それ以外の活字・二声・レイアウト・判型はPDF版と同じ。
 */
(function (global) {
  'use strict';

  // ── 固定文（誰の要望書でも共通・脚色ではなく姿勢の宣言）──────────────────────
  var ABOUT =
    'この資料は、住まい手との対話から編まれています。' +
    '設計の要望を並べる前に、まず「どんな人が、どんな一日を生きているか」を記しました。' +
    'ところどころに引かれた本人の言葉は、要約せず、そのまま残しています。' +
    '何気ない一言に、大切な感情が残っていると思います。';

  var CONTEMPLATION =
    'この資料は、ある日の対話から編まれた、いまの暮らしの記録です。' +
    'けれど、住まいをめぐる思索は、ここで終わるものではありません。' +
    '日々のなかで、手にしている物のこと、一日の時間の使い方、' +
    '心地よいと感じた場所のことを、これからも折にふれて思い返してみてください。' +
    'その一つひとつが、これからの住まいの輪郭を、少しずつ確かなものにしていきます。';

  var APP_MARK = 'みらいの家 — mirai no ie';

  // 質感ページの「避けたいもの」は一般的な傾向。materials未生成時のフォールバック。
  var AVOID_FALLBACK = ['鮮やかすぎる色', '細かすぎるデザイン', '強すぎるアクセント', '主張の強すぎるもの'];

  // ── HTMLヘルパ ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function kicker(latin, num) {
    var n = num ? '<span class="folio-index">' + esc(num) + '</span>' : '';
    return '<div class="kickrow">' + n + '<span class="kicker">' + esc(latin) + '</span></div>';
  }
  function quote(text) {
    return '<blockquote class="q">' + esc(text) + '</blockquote>';
  }
  function lines(xs, cls) {
    if (!xs || !xs.length) return '';
    return '<ul class="' + cls + '">' + xs.map(function (x) {
      return '<li>' + esc(x) + '</li>';
    }).join('') + '</ul>';
  }
  function page(sectionLabel, inner, named, cls) {
    var style = 'string-set: sec "' + (sectionLabel || '') + '";';
    var namedCls = named ? ' pg-' + named : '';
    return '<section class="page' + namedCls + ' ' + (cls || '') + '" style="' + style + '">' + inner + '</section>';
  }

  // ── レンダラ本体 ────────────────────────────────────────────────────────────
  function renderBrief(report, editorial, history) {
    var ed = editorial || {};
    var sections = (report && report.sections) || [];
    var secMap = {};
    sections.forEach(function (s) { secMap[s.id] = s; });
    function items(id) { return (secMap[id] && secMap[id].items) || []; }
    function label(id) { return (secMap[id] && secMap[id].label) || ''; }
    function roomName(id) {
      // 「各空間 — 玄関」等の接頭を外す（em dash / hyphen 両対応）
      var lb = label(id);
      var parts = lb.split(/[—–-]/);
      return (parts[parts.length - 1] || lb).trim();
    }

    // 日付（generatedAt → YYYY.MM.DD）
    var dateJp = '';
    try {
      var d = report && report.generatedAt ? new Date(report.generatedAt) : new Date();
      var mm = ('0' + (d.getMonth() + 1)).slice(-2);
      var dd = ('0' + d.getDate()).slice(-2);
      dateJp = d.getFullYear() + '.' + mm + '.' + dd;
    } catch (e) { dateJp = ''; }

    // EDITORIAL の各素材（無ければ静かに省く）
    var Q_PURPOSE = ed.purpose_quote || '';
    var Q_SELF    = ed.self_quote || '';
    var WHO_LEDE  = ed.who_lede || '';
    var TIMELINE  = (ed.timeline || []).map(function (r) { return [r[0] || '', r[1] || '']; });
    var RHYTHM_NOTE = ed.rhythm_note || '';
    var VALUES = (ed.values || []).map(function (v, i) {
      return [('0' + (i + 1)).slice(-2), v.label || '', v.quote || ''];
    });
    var THEMES = (ed.themes || []).map(function (t, i) {
      return [('0' + (i + 1)).slice(-2), t.jp || '', t.en || '', t.evidence || [], t.wish || []];
    });
    var ROOMS = (ed.rooms || [])
      .filter(function (r) { return secMap[r.id]; })
      .map(function (r) { return [roomName(r.id), r.id, r.essence || '']; });
    var STATEMENT = ed.statement || '';

    // ── ページ関数 ──
    function cover() {
      var inner =
        '<div class="cover-top">' +
          '<div class="cover-en">DESIGN&nbsp;BRIEF</div>' +
          '<div class="cover-rule"></div>' +
          '<div class="cover-date">' + esc(dateJp) + '</div>' +
          '<div class="cover-jp">暮らしと住まい<br>ヒアリング</div>' +
        '</div>';
      return page('', inner, 'cover');
    }
    function about() {
      var inner = kicker('ABOUT') +
        '<div class="about-wrap"><h2 class="about-h">この資料について</h2>' +
        '<p class="about-p">' + esc(ABOUT) + '</p></div>';
      return page('ABOUT', inner, 'plain');
    }
    function purpose() {
      var body = kicker('PURPOSE', '01') +
        '<h1 class="ph">住まいづくりの目的</h1>' +
        quote(Q_PURPOSE) +
        '<div class="purpose-list">' + lines(items('purpose'), 'biglist') + '</div>';
      return page('PURPOSE', body);
    }
    function who() {
      var facts = items('profile_now').slice(0, 8);
      var body = kicker('USER', '02') +
        '<h1 class="ph">住まい手</h1>' +
        '<p class="lede">' + esc(WHO_LEDE) + '</p>' +
        quote(Q_SELF) +
        '<div class="factgrid">' + lines(facts, 'facts') + '</div>';
      return page('USER', body);
    }
    function rhythm() {
      var rows = TIMELINE.map(function (r) {
        return '<div class="tl-row"><div class="tl-t">' + esc(r[0]) + '</div>' +
               '<div class="tl-d">' + esc(r[1]) + '</div></div>';
      }).join('');
      var note = RHYTHM_NOTE ? '<p class="tl-note">' + esc(RHYTHM_NOTE) + '</p>' : '';
      var body = kicker('A DAY', '03') +
        '<h1 class="ph">一日の流れ</h1>' +
        '<div class="timeline">' + rows + '</div>' + note;
      return page('A DAY', body);
    }
    function values() {
      var blocks = VALUES.map(function (v) {
        return '<div class="val"><div class="val-n">' + esc(v[0]) + '</div>' +
          '<div class="val-body"><div class="val-t">' + esc(v[1]) + '</div>' +
          '<div class="val-q">' + esc(v[2]) + '</div></div></div>';
      }).join('');
      var body = kicker('VALUES', '04') +
        '<h1 class="ph">大切にしたいこと</h1><div class="vals">' + blocks + '</div>';
      return page('VALUES', body);
    }
    function theme(num, jp, en, evidence, wish) {
      var ev = (evidence || []).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('');
      var wi = (wish || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
      var body = kicker('DESIGN THEME — ' + num) +
        '<div class="th-head"><h1 class="th-jp">' + esc(jp) + '</h1>' +
        '<div class="th-en">' + esc(en) + '</div></div>' +
        '<div class="th-cols">' +
          '<div class="th-col th-ev"><div class="th-lab">対話からの根拠</div>' +
          '<ul class="th-list ev">' + ev + '</ul></div>' +
          '<div class="th-col th-im"><div class="th-lab">住まい手の望み</div>' +
          '<ul class="th-list im">' + wi + '</ul></div>' +
        '</div>';
      return page('THEME', body);
    }
    function requirements() {
      var pagesHtml = [];
      function roomBlock(name, sid, essence) {
        return '<div class="room"><div class="room-head">' +
          '<span class="room-name">' + esc(name) + '</span>' +
          '<span class="room-e">' + esc(essence) + '</span></div>' +
          lines(items(sid), 'reqlist') + '</div>';
      }
      var chunks = [];
      for (var i = 0; i < ROOMS.length; i += 2) chunks.push(ROOMS.slice(i, i + 2));
      chunks.forEach(function (chunk, idx) {
        var head = idx === 0
          ? kicker('REQUIREMENT', '05')
          : '<div class="kickrow"><span class="kicker">REQUIREMENT</span></div>';
        var title = idx === 0 ? '<h1 class="ph small">部屋別の要件</h1>' : '';
        var blocks = chunk.map(function (r) { return roomBlock(r[0], r[1], r[2]); }).join('');
        pagesHtml.push(page('REQUIREMENT', head + title + '<div class="rooms">' + blocks + '</div>'));
      });
      return pagesHtml.join('');
    }
    function aesthetics() {
      var mat = ed.materials || {};
      var keep = (mat.keep && mat.keep.length) ? mat.keep : items('aesthetics');
      var avoid = (mat.avoid && mat.avoid.length) ? mat.avoid : AVOID_FALLBACK;
      var body = kicker('MATERIAL', '06') +
        '<h1 class="ph">質感と好み</h1>' +
        '<div class="mat-cols">' +
          '<div class="mat-col"><div class="mat-lab">目指す質感</div>' + lines(keep, 'matlist') + '</div>' +
          '<div class="mat-col"><div class="mat-lab">避けたいもの</div>' + lines(avoid, 'matlist') + '</div>' +
        '</div>';
      return page('MATERIAL', body);
    }
    function designerMemo() {
      var body = kicker('FOCUS POINT', '08') +
        '<h1 class="ph">着眼点</h1>' +
        '<p class="lede">対話の全体から、特に伝えたい要点を。</p>' +
        lines(items('designer_memo'), 'memolist');
      return page('FOCUS POINT', body);
    }
    function contemplation() {
      var body = kicker('KEEP THINKING', '09') +
        '<h1 class="ph">暮らしの思索は続いていく</h1>' +
        '<p class="about-p" style="max-width:112mm; margin-top:2mm">' + esc(CONTEMPLATION) + '</p>';
      return page('KEEP THINKING', body);
    }
    function statement() {
      var inner = '<div class="stmt-wrap">' +
        '<div class="stmt-en">DESIGN STATEMENT</div>' +
        '<p class="stmt">' + esc(STATEMENT) + '</p>' +
        '<div class="stmt-mark">' + esc(APP_MARK) + '</div></div>';
      return page('', inner, 'statement');
    }

    // 対話の清書（別添）。history を verbatim で収める（要望書生成のやりとりは除く）。
    var EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{200D}]+/gu;
    function cleanTurn(t) {
      t = t.replace(/【[^】]*】/g, '');
      t = t.replace(EMOJI, '');
      t = t.replace(/[ \t]+\n/g, '\n');
      return t.replace(/\n{3,}/g, '\n\n').trim();
    }
    function transcript(hist) {
      if (!hist || !hist.length) return '';
      var conv = [];
      for (var i = 0; i < hist.length; i++) {
        var m = hist[i], c = m && m.content;
        if (typeof c !== 'string') continue;
        if (c.indexOf('生活要望書」をJSON形式で') >= 0) break;
        c = cleanTurn(c);
        if (!c) continue;
        conv.push([m.role, c]);
      }
      // 軽い重複整理: 直前と同じ答えの繰り返しを、間の再質問ごと畳む。相づちは残す。
      var STOP = { 'はい':1,'いいえ':1,'うん':1,'ううん':1,'ええ':1,'そう':1,'そうです':1,
        '大丈夫':1,'大丈夫です':1,'まあまあ':1,'特にない':1,'特になし':1,'ない':1,'ないです':1,
        'yes':1,'no':1,'ok':1,'OK':1 };
      var deduped = [], prevUser = null;
      conv.forEach(function (row) {
        var role = row[0], text = row[1];
        if (role === 'user' && prevUser !== null && text.trim() === prevUser && !STOP[text.trim()]) {
          if (deduped.length && deduped[deduped.length - 1][0] !== 'user') deduped.pop();
          return;
        }
        deduped.push(row);
        if (role === 'user') prevUser = text.trim();
      });
      conv = deduped;
      // 問い(assistant)→答え(user) をペアに
      var rows = '', j = 0;
      while (j < conv.length) {
        var role2 = conv[j][0], text2 = conv[j][1];
        if (role2 !== 'user' && j + 1 < conv.length && conv[j + 1][0] === 'user') {
          rows += '<div class="tx-pair"><div class="tx-q">' + esc(text2).replace(/\n/g, '<br>') +
            '</div><div class="tx-a">' + esc(conv[j + 1][1]).replace(/\n/g, '<br>') + '</div></div>';
          j += 2;
        } else {
          var cls = (role2 === 'user') ? 'tx-a' : 'tx-q';
          rows += '<div class="tx-pair"><div class="' + cls + '">' + esc(text2).replace(/\n/g, '<br>') + '</div></div>';
          j += 1;
        }
      }
      var coverPg = page('APPENDIX', kicker('APPENDIX') +
        '<h1 class="ph">対話の記録</h1>' +
        '<p class="lede">この要望書のもとになった対話を、要約せず、そのまま収めています。' +
        '細字が問いかけ、太字が住まい手の言葉です。</p>', 'plain');
      return coverPg + '<section class="tx" style=\'string-set: sec "TRANSCRIPT";\'>' + rows + '</section>';
    }

    var BODY =
      cover() + about() + purpose() + who() + rhythm() + values() +
      THEMES.map(function (t) { return theme(t[0], t[1], t[2], t[3], t[4]); }).join('') +
      requirements() + aesthetics() +
      designerMemo() + contemplation() + statement() +
      transcript(history);

    // viewport width=576（=152.4mm相当）: 画面ではブック1ページ幅で組み、狭い端末では幅にフィット。
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=576">' +
      '<style>' + BRIEF_CSS + '</style></head><body>' + BODY + '</body></html>';
  }

  // ── CSS（Webフォント版：CJK名を非CJK名に、@importを先頭に）──────────────────
  var BRIEF_CSS =
"@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=Noto+Sans+JP:wght@300;400;500&family=Noto+Serif+JP:wght@300;400;500&display=swap');\n" +
":root{--paper:#ffffff;--ink:#211e18;--ink2:#5a5346;--faint:#a89d89;--hair:#d9d0be;--clay:#8a6a4c;}\n" +
"@page{size:152.4mm 228.6mm;margin:24mm 22mm 20mm 22mm;background:var(--paper);" +
"@bottom-left{content:string(sec);font-family:'Lora';font-size:6.5pt;letter-spacing:2.2pt;color:var(--clay);}" +
"@bottom-right{content:counter(page,decimal-leading-zero);font-family:'Lora';font-size:7.5pt;letter-spacing:1pt;color:var(--faint);}}\n" +
"@page pg-cover{margin:0;@bottom-left{content:none}@bottom-right{content:none}}\n" +
"@page pg-statement{@bottom-left{content:none}@bottom-right{content:none}}\n" +
"html{color:var(--ink);}\n*{box-sizing:border-box;}\n.page{page-break-after:always;}\n.pg-cover{page:pg-cover;}\n.pg-statement{page:pg-statement;}\n" +
".ph,.th-jp,.q,.about-h,.about-p,.lede,.val-t,.val-e,.val-q,.th-framing,.stmt,.cover-jp,.pri-tier,.room-name,.mat-lab,.th-lab{font-family:'Lora','Noto Serif JP',serif;}\n" +
".kicker,.folio-index,.itemlist,.facts,.reqlist,.matlist,.prilist,.memolist,.biglist,.tl-t,.tl-d,.tl-note,.nx-t,.nx-d,.val-n,.th-en,.cover-en,.th-list,.cover-name,.cover-date,.cover-mark,.stmt-en,.stmt-mark,.room-e,.val,.nexts{font-family:'Noto Sans JP',sans-serif;}\n" +
".kickrow{display:block;margin-bottom:12mm;}\n.kicker{font-size:7.5pt;letter-spacing:3.4pt;color:var(--clay);font-weight:500;text-transform:uppercase;}\n" +
".folio-index{font-family:'Lora';font-size:9pt;color:var(--faint);letter-spacing:1pt;margin-right:8pt;}\n" +
"h1.ph{font-weight:300;font-size:23pt;letter-spacing:.5pt;line-height:1.3;margin:0 0 9mm 0;color:var(--ink);}\n" +
"h1.ph.small{font-size:20pt;margin-bottom:7mm;}\n" +
".lede{font-weight:400;font-size:10.5pt;line-height:2.0;color:var(--ink2);margin:0 0 6mm 0;max-width:112mm;}\n" +
".q{font-weight:400;font-size:13pt;line-height:1.95;color:var(--ink);margin:7mm 0;padding-left:7mm;border-left:1.2pt solid var(--clay);max-width:112mm;}\n" +
"ul{list-style:none;margin:0;padding:0;}\n" +
".itemlist li,.facts li,.reqlist li,.matlist li,.prilist li,.memolist li{font-size:9.5pt;line-height:1.65;color:var(--ink2);font-weight:300;padding:2.4mm 0 2.4mm 6mm;text-indent:-6mm;}\n" +
".itemlist li::before,.facts li::before,.reqlist li::before,.matlist li::before,.prilist li::before,.memolist li::before{content:'—';color:var(--clay);margin-right:3mm;}\n" +
".biglist li{font-size:11.5pt;line-height:1.55;color:var(--ink);font-weight:300;padding:3mm 0 3mm 7mm;text-indent:-7mm;border-bottom:.6pt solid var(--hair);}\n" +
".biglist li:last-child{border-bottom:none;}\n.biglist li::before{content:'—';color:var(--clay);margin-right:3.5mm;}\n.purpose-list{margin-top:8mm;max-width:118mm;}\n" +
".factgrid{margin-top:6mm;}\n.facts{column-count:2;column-gap:10mm;}\n.facts li{break-inside:avoid;}\n" +
".timeline{margin-top:2mm;border-top:.6pt solid var(--hair);}\n.tl-row{display:table;width:100%;border-bottom:.6pt solid var(--hair);}\n" +
".tl-t{display:table-cell;width:26mm;padding:2.9mm 0;vertical-align:top;font-family:'Lora';font-size:10.5pt;color:var(--clay);letter-spacing:.5pt;}\n" +
".tl-d{display:table-cell;padding:2.9mm 0;vertical-align:top;font-size:9.8pt;line-height:1.5;color:var(--ink2);font-weight:300;}\n" +
".tl-note{margin-top:5mm;font-size:8.6pt;line-height:1.7;color:var(--faint);font-weight:300;}\n" +
".vals{margin-top:2mm;}\n.val{display:table;width:100%;padding:6mm 0;border-bottom:.6pt solid var(--hair);}\n.val:last-child{border-bottom:none;}\n" +
".val-n{display:table-cell;width:20mm;vertical-align:top;font-family:'Lora';font-size:15pt;color:var(--faint);letter-spacing:1pt;}\n" +
".val-body{display:table-cell;vertical-align:top;}\n.val-t{font-size:15pt;font-weight:400;color:var(--ink);margin-bottom:2.5mm;}\n" +
".val-e{font-size:10pt;color:var(--ink2);line-height:1.7;margin-bottom:3.5mm;}\n" +
".val-q{font-size:11pt;color:var(--ink);line-height:1.8;padding-left:5mm;border-left:1pt solid var(--clay);}\n" +
".th-head{display:table;width:100%;margin-bottom:4mm;}\n" +
".th-jp{display:table-cell;vertical-align:baseline;font-weight:300;font-size:30pt;letter-spacing:1pt;color:var(--ink);margin:0;}\n" +
".th-en{display:table-cell;vertical-align:baseline;text-align:right;font-size:9pt;letter-spacing:2.5pt;color:var(--faint);text-transform:uppercase;}\n" +
".th-cols{display:table;width:100%;border-top:.8pt solid var(--hair);padding-top:7mm;}\n" +
".th-col{display:table-cell;width:50%;vertical-align:top;}\n.th-ev{padding-right:8mm;border-right:.6pt solid var(--hair);}\n.th-im{padding-left:8mm;}\n" +
".th-lab{font-size:8pt;letter-spacing:2.5pt;text-transform:uppercase;color:var(--clay);margin-bottom:5mm;font-weight:500;font-family:'Noto Sans JP';}\n" +
".th-list li{font-size:9.6pt;line-height:1.7;padding:2.6mm 0;font-weight:300;}\n" +
".th-list.ev li{color:var(--ink);font-family:'Lora','Noto Serif JP',serif;}\n.th-list.im li{color:var(--ink2);}\n" +
".rooms{margin-top:1mm;}\n.room{padding:4mm 0 4mm 0;border-bottom:.6pt solid var(--hair);break-inside:avoid;}\n.room:last-child{border-bottom:none;}\n" +
".room-head{margin-bottom:2.5mm;}\n.room-name{font-size:13pt;font-weight:400;color:var(--ink);margin-right:5mm;}\n.room-e{font-size:9pt;color:var(--faint);font-weight:300;}\n" +
".reqlist{column-count:2;column-gap:9mm;}\n.reqlist li{break-inside:avoid;padding-top:1.4mm;padding-bottom:1.4mm;}\n" +
".mat-cols{display:table;width:100%;margin-top:3mm;}\n.mat-col{display:table-cell;width:50%;vertical-align:top;}\n" +
".mat-col:first-child{padding-right:8mm;border-right:.6pt solid var(--hair);}\n.mat-col:last-child{padding-left:8mm;}\n" +
".mat-lab{font-size:9pt;letter-spacing:1pt;color:var(--clay);margin-bottom:4mm;font-weight:500;}\n.matlist li{padding-top:2.8mm;padding-bottom:2.8mm;line-height:1.5;}\n" +
".memolist{margin-top:4mm;column-count:1;}\n.memolist li{font-size:9.6pt;padding:2.8mm 0 2.8mm 6mm;}\n" +
".about-wrap{margin-top:34mm;max-width:112mm;}\n.about-h{font-weight:300;font-size:16pt;margin:0 0 8mm 0;color:var(--ink);}\n" +
".about-p{font-size:10.5pt;line-height:2.2;color:var(--ink2);font-weight:400;}\n" +
".pg-cover{padding:26mm 22mm;height:100%;position:relative;}\n.cover-top{margin-top:24mm;}\n" +
".cover-en{font-family:'Lora';font-size:11pt;letter-spacing:8pt;color:var(--clay);}\n.cover-rule{width:24mm;height:1.4pt;background:var(--ink);margin:9mm 0;}\n" +
".cover-date{font-family:'Lora';font-size:10pt;letter-spacing:2pt;color:var(--ink2);margin:6mm 0 9mm 0;}\n" +
".cover-jp{font-weight:300;font-size:26pt;letter-spacing:2.5pt;line-height:1.5;color:var(--ink);}\n" +
".pg-statement{height:100%;}\n.stmt-wrap{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;height:150mm;max-width:118mm;margin:24mm auto 0 auto;}\n" +
".stmt-en{font-family:'Lora';font-size:8.5pt;letter-spacing:4pt;color:var(--clay);margin-bottom:12mm;}\n" +
".stmt{font-weight:300;font-size:16pt;line-height:2.4;color:var(--ink);letter-spacing:.5pt;margin:0;}\n" +
".stmt-mark{margin-top:20mm;font-size:7.5pt;letter-spacing:1.5pt;color:var(--faint);}\n" +
".tx{page-break-before:always;}\n.tx-pair{break-inside:avoid;margin-bottom:6mm;}\n" +
".tx-q{font-family:'Noto Sans JP',sans-serif;font-size:8.4pt;line-height:1.7;color:var(--faint);font-weight:400;margin-bottom:2mm;}\n" +
".tx-a{font-family:'Lora','Noto Serif JP',serif;font-size:10pt;line-height:1.85;color:var(--ink);font-weight:400;padding-left:5mm;border-left:1pt solid var(--hair);}\n";

  global.renderBrief = renderBrief;
  global.BRIEF_CSS = BRIEF_CSS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderBrief: renderBrief, BRIEF_CSS: BRIEF_CSS };
  }
})(typeof window !== 'undefined' ? window : this);
