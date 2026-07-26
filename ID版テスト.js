/* =====================================================================
 * ID化テスト.js — マダミス時系列整理 動作テスト（コンソール貼り付け用）
 *
 * 使い方:
 *   1) マダミス時系列整理.html をブラウザで開く
 *   2) 開発者ツールのコンソールに、このファイルの中身を全部貼り付けて Enter
 *   3) レポートが表示されます（あなたのデータは自動でバックアップ→復元されます）
 *   4) テスト後にページを再読込すると、元のデータの表示に戻ります
 *
 * 注意:
 *   - このスクリプトはアプリ本体（HTML）を一切変更しません
 *   - 見た目スナップショット（snapHash）のベースラインを取り直したいときは、
 *     先に window.__IDKA_RESET_BASELINE__ = true; を実行してから貼り付けてください
 * =================================================================== */
(async function () {
  'use strict';
  const R = { results: [], alerts: [], confirms: [], meta: {} };
  const origConfirm = window.confirm, origAlert = window.alert;
  let confirmQueue = [];
  window.confirm = (msg) => { R.confirms.push(String(msg)); return confirmQueue.length ? confirmQueue.shift() : true; };
  window.alert = (msg) => { R.alerts.push(String(msg)); };

  // ---- あなたのデータをバックアップ（madamisu_ で始まるキー全部） ----
  const backup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('madamisu_') === 0) backup[k] = localStorage.getItem(k);
  }

  // ---- テスト用の固定データ（フィクスチャ） ----
  const FIX_CHARS = [
    { name: 'アリス', color: '#e74c3c' },
    { name: 'ボブ', color: '#3498db', locked: true },
    { name: 'カレン', color: '#2ecc71' }
  ];
  const FIX_EVENTS = [
    { time: '9:00', text: '朝食をとった', characters: ['アリス'], character: 'アリス', color: '#e74c3c', flag: false },
    { time: '10:15', text: '庭を散歩', characters: ['ボブ'], character: 'ボブ', color: '#3498db', flag: false },
    { time: '21:30', endTime: '22:10', text: '書斎で会合', characters: ['アリス', 'ボブ'], character: 'アリス', color: '#e74c3c', flag: true },
    { time: '', text: '悲鳴を聞いた', characters: ['カレン'], character: 'カレン', color: '#2ecc71', flag: false }
  ];

  // フィクスチャを描画済みの状態にリセットする（各テストの独立性を保つ）
  function resetFixture() {
    events = JSON.parse(JSON.stringify(FIX_EVENTS));
    characters = JSON.parse(JSON.stringify(FIX_CHARS));
    if (typeof ensureEventIds === 'function') ensureEventIds(); // Phase 1以降はID付与も通す
    charFilter = []; flagFilter = 'all';
    newEventChars = []; newEventFlag = false; newEventRange = false;
    // 編集状態のリセット（レビュー指摘1対応の前後どちらの版でも動くよう、存在する変数だけ初期化）
    if (typeof editingIndex !== 'undefined') { editingIndex = -1; }
    if (typeof editingTimeIndex !== 'undefined') { editingTimeIndex = -1; }
    if (typeof editingCharacterIndex !== 'undefined') { editingCharacterIndex = -1; }
    if (typeof editingId !== 'undefined') { editingId = null; }
    if (typeof editingTimeId !== 'undefined') { editingTimeId = null; }
    if (typeof editingCharacterName !== 'undefined') { editingCharacterName = null; }
    compareOrder = []; compareOrderFixed = false; hideConcealedInCompare = false;
    confirmDelete = true; timelineMode = 'list';
    deathEnabled = false; deathFrom = ''; deathTo = '';
    localStorage.setItem(KEYS.events, JSON.stringify(events));
    localStorage.setItem(KEYS.characters, JSON.stringify(characters));
    localStorage.setItem(KEYS.timelineMode, 'list');
    updateDeathToggleBtn(); updateDeathWarn();
    renderCharacters(); updateCardColorCss(); updateTimelineModeBtn();
    resetAddEventForm();
    sortEvents(); renderEvents();
  }

  // ---- 小さな道具たち ----
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  function cards() { return $$('#timelineContainer .timeline-item'); }
  function cardByText(text) {
    return cards().find(el => { const t = el.querySelector('.event-text'); return t && t.textContent === text; });
  }
  function press(el, key) { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }
  function ok(cond, msg) { if (!cond) throw new Error(msg); }
  function t(name, fn) {
    try { fn(); R.results.push({ name, status: 'PASS' }); }
    catch (e) {
      if (e && e.skip) R.results.push({ name, status: 'SKIP', detail: e.reason || '' });
      else R.results.push({ name, status: 'FAIL', detail: String((e && e.message) || e) });
    }
  }
  // 見た目スナップショット：onclick等のイベント属性と data-ev-id を除いたHTMLのハッシュ
  // （ID化で「変わってよい」のはこの2種類の属性だけ。それ以外が1文字でも変わると値が変わる）
  function snapHash() {
    let s = document.getElementById('timelineContainer').innerHTML;
    s = s.replace(/\s*on[a-z]+="[^"]*"/g, '').replace(/\s*data-ev-id="[^"]*"/g, '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  try {
    // =================== テスト本体 ===================

    resetFixture();
    t('T1 初期描画（カード4枚・バッジ・フラグ・人物一覧）', () => {
      ok(cards().length === 4, 'カードが4枚でない: ' + cards().length);
      const asa = cardByText('朝食をとった');
      ok(asa, '朝食カードが見つからない');
      ok($$('.char-badge-name', asa).some(b => b.textContent === 'アリス'), '朝食カードにアリスのバッジがない');
      const kaigo = cardByText('書斎で会合');
      ok(kaigo && kaigo.classList.contains('flagged'), '書斎カードにフラグ表示がない');
      ok($$('#characterList .char-item').length === 3, '人物一覧が3人でない');
      ok($$('#characterList .btn-unlock-char').length === 1, 'ロック中の人物（ボブ）の🔐が1つでない');
    });

    resetFixture();
    t('T2 削除（確認キャンセル→残る／OK→消える）', () => {
      confirmQueue = [false];
      cardByText('朝食をとった').querySelector('.btn-delete').click();
      ok(events.length === 4, 'キャンセルしたのに削除された');
      confirmQueue = [true];
      cardByText('朝食をとった').querySelector('.btn-delete').click();
      ok(events.length === 3, '削除されていない: ' + events.length);
      ok(!cardByText('朝食をとった'), 'カードが画面に残っている');
      ok(JSON.parse(localStorage.getItem(KEYS.events)).length === 3, '保存データに反映されていない');
    });

    resetFixture();
    t('T3 フラグ切替×2（部分更新）', () => {
      cardByText('庭を散歩').querySelector('.btn-flag-card').click();
      const ev = events.find(e => e.text === '庭を散歩');
      ok(ev.flag === true, 'flagがtrueにならない');
      ok(cardByText('庭を散歩').classList.contains('flagged'), 'flaggedクラスが付かない');
      ok(cardByText('庭を散歩').querySelector('.btn-flag-card').classList.contains('active'), '🚩ボタンがactiveにならない');
      cardByText('庭を散歩').querySelector('.btn-flag-card').click();
      ok(ev.flag === false, '2回目でflagがfalseに戻らない');
      ok(!cardByText('庭を散歩').classList.contains('flagged'), 'flaggedクラスが消えない');
    });

    resetFixture();
    t('T4 内容の非表示/再表示（再表示で色隠しも解除）', () => {
      const name = '庭を散歩';
      cardByText(name).querySelector('.btn-conceal').click();
      const ev = events.find(e => e.text === name);
      ok(ev.concealed === true, 'concealedがtrueにならない');
      ok(cardByText(name).classList.contains('concealed'), 'concealedクラスが付かない');
      cardByText(name).querySelector('.btn-color-toggle').click();
      ok(ev.colorHidden === true, '色隠しがtrueにならない');
      cardByText(name).querySelector('.btn-conceal').click();
      ok(ev.concealed === false && ev.colorHidden === false, '再表示で色隠しが解除されない');
      ok(!cardByText(name).classList.contains('concealed') && !cardByText(name).classList.contains('color-hidden'), '見た目クラスが戻らない');
    });

    resetFixture();
    t('T5 色を隠す/戻す（🎨）', () => {
      const name = '朝食をとった';
      cardByText(name).querySelector('.btn-color-toggle').click();
      const ev = events.find(e => e.text === name);
      ok(ev.colorHidden === true, 'colorHiddenがtrueにならない');
      ok(cardByText(name).classList.contains('color-hidden'), 'color-hiddenクラスが付かない');
      ok(cardByText(name).querySelector('.btn-color-toggle').classList.contains('active'), '🎨ボタンがactiveにならない');
      cardByText(name).querySelector('.btn-color-toggle').click();
      ok(ev.colorHidden === false, '2回目で戻らない');
    });

    resetFixture();
    t('T6 時刻なしカードの⬆⬇移動', () => {
      const name = '悲鳴を聞いた';
      const posOf = () => cards().findIndex(el => { const x = el.querySelector('.event-text'); return x && x.textContent === name; });
      const before = posOf();
      ok(before >= 0, 'カードが見つからない');
      cardByText(name).querySelector('.btn-move-up').click();
      ok(posOf() === before - 1, '上に動いていない (' + before + '→' + posOf() + ')');
      const ev = events.find(e => e.text === name);
      ok(typeof ev.anchor === 'number', 'anchor(手動位置)が保存されていない');
      cardByText(name).querySelector('.btn-move-down').click();
      ok(posOf() === before, '下に戻らない (' + posOf() + ')');
    });

    resetFixture();
    t('T7 時間バッジで時間だけ編集（不詳→8:00で先頭へ）', () => {
      const name = '悲鳴を聞いた';
      cardByText(name).querySelector('.time-badge').click();
      const input = document.querySelector('#timelineContainer .edit-time-inline');
      ok(input, '時間編集欄が開かない');
      input.value = '8:00';
      press(input, 'Enter');
      const ev = events.find(e => e.text === name);
      ok(ev && timeToMinutes(ev.time) === 480, '時間が保存されていない: ' + (ev && ev.time));
      ok(ev.anchor === undefined, 'anchor(手動位置)が片付いていない');
      ok(cards()[0] === cardByText(name), '先頭に並び替わっていない');
    });

    resetFixture();
    t('T8 フル編集（✏️→内容と時間を変更して保存）', () => {
      cardByText('庭を散歩').querySelector('.btn-edit-card').click();
      const form = document.querySelector('#timelineContainer .edit-mode');
      ok(form, '編集フォームが開かない');
      form.querySelector('.edit-time').value = '10:45';
      form.querySelector('.edit-text').value = '庭を散歩した';
      form.closest('.timeline-item').querySelector('.compare-edit-save').click();
      const ev = events.find(e => e.text === '庭を散歩した');
      ok(ev, '内容が保存されていない');
      ok(ev.time === '10:45', '時間が保存されていない: ' + ev.time);
      ok(cardByText('庭を散歩した'), '画面に反映されていない');
      const editCleared = (typeof editingId !== 'undefined') ? (editingId === null) : (editingIndex === -1);
      ok(editCleared, '編集モードが解除されていない');
    });

    resetFixture();
    t('T9 人物比較ビュー切替と比較ビューからの操作', () => {
      document.getElementById('modeCompareBtn').click();
      const table = document.querySelector('#timelineContainer .compare-table');
      ok(table, '比較テーブルが表示されない');
      const heads = $$('.compare-col-name', table).map(e => e.textContent);
      ok(heads.join(',') === 'アリス,ボブ,カレン', '列の並びが想定外: ' + heads.join(','));
      ok($$('.compare-range-fill', table).length === 2, '期間カードの表示数が想定外: ' + $$('.compare-range-fill', table).length);
      const cardEls = $$('.compare-card', table);
      ok(cardEls.length === 3, '比較カードが3枚でない: ' + cardEls.length);
      const asa = cardEls.find(el => el.textContent.indexOf('朝食をとった') >= 0);
      ok(asa, '比較ビューに朝食カードがない');
      asa.querySelector('.compare-flag').click();
      ok(events.find(e => e.text === '朝食をとった').flag === true, '比較ビューからフラグが切り替わらない');
      document.getElementById('modeListBtn').click();
      ok(document.querySelector('#timelineContainer .timeline-item'), 'リスト表示に戻らない');
    });

    resetFixture();
    t('T10 期間カード（開始〜終了の保持）', () => {
      const c = cardByText('書斎で会合');
      ok(c, '期間カードが見つからない');
      const badge = c.querySelector('.time-badge');
      ok(badge.textContent.indexOf('21:30') >= 0 && badge.textContent.indexOf('22:10') >= 0, '期間の時刻表示が想定外: ' + badge.textContent);
      c.querySelector('.btn-flag-card').click();
      const ev = events.find(e => e.text === '書斎で会合');
      ok(ev.flag === false, 'フラグ解除が反映されない');
      ok(ev.endTime === '22:10', '終了時刻が消えた');
      ok(cardByText('書斎で会合'), '再描画後にカードが見つからない');
    });

    resetFixture();
    t('T11 追加＋保存データ一致', () => {
      document.getElementById('timeInput').value = '12:00';
      document.getElementById('eventInput').value = 'テスト追加';
      document.querySelector('button[onclick="addEvent()"]').click();
      ok(events.length === 5, '追加されていない: ' + events.length);
      const idx = cards().findIndex(el => { const x = el.querySelector('.event-text'); return x && x.textContent === 'テスト追加'; });
      ok(idx === 2, '並び順が想定外(10:15と21:30の間でない): ' + idx);
      ok(JSON.stringify(JSON.parse(localStorage.getItem(KEYS.events))) === JSON.stringify(events), '保存データとメモリ内データが一致しない');
    });

    resetFixture();
    t('T14 比較ビューでの✏️編集（内容と時間の保存）', () => {
      document.getElementById('modeCompareBtn').click();
      const table = document.querySelector('#timelineContainer .compare-table');
      ok(table, '比較テーブルが表示されない');
      const asa = $$('.compare-card', table).find(el => el.textContent.indexOf('朝食をとった') >= 0);
      ok(asa, '比較ビューに朝食カードがない');
      asa.querySelector('.compare-edit-btn').click();
      const form = document.querySelector('#timelineContainer .compare-edit');
      ok(form, '比較ビューの編集フォームが開かない');
      form.querySelector('.compare-edit-text').value = '朝食を食べた';
      form.querySelector('.compare-edit-time').value = '9:30';
      form.querySelector('.compare-edit-save').click();
      const ev = events.find(e => e.text === '朝食を食べた');
      ok(ev, '内容が保存されていない');
      ok(ev.time === '9:30', '時間が保存されていない: ' + ev.time);
      ok($$('#timelineContainer .compare-card').some(el => el.textContent.indexOf('朝食を食べた') >= 0), '比較ビューに反映されていない');
      document.getElementById('modeListBtn').click();
    });

    resetFixture();
    t('T15 👥ポップアップで人物の追加/削除', () => {
      cardByText('朝食をとった').querySelector('.btn-add-char-card').click();
      const popup = cardByText('朝食をとった').querySelector('[id^="charAssign-"]');
      ok(popup && popup.classList.contains('open'), 'ポップアップが開かない');
      const rows = $$('.char-check-row', popup);
      ok(rows.length === 3, '人物の行数が想定外: ' + rows.length);
      rows.find(r => r.textContent.indexOf('カレン') >= 0).querySelector('input').click();
      let ev = events.find(e => e.text === '朝食をとった');
      ok(eventCharNames(ev).join(',') === 'アリス,カレン', '人物追加が保存されない: ' + eventCharNames(ev).join(','));
      const popup2 = cardByText('朝食をとった').querySelector('[id^="charAssign-"]');
      ok(popup2 && popup2.classList.contains('open'), '操作後にポップアップが開き直されない');
      $$('.char-check-row', popup2).find(r => r.textContent.indexOf('カレン') >= 0).querySelector('input').click();
      ev = events.find(e => e.text === '朝食をとった');
      ok(eventCharNames(ev).join(',') === 'アリス', '人物削除が保存されない: ' + eventCharNames(ev).join(','));
    });

    resetFixture();
    t('T16 編集中に別カードを削除しても編集対象がズレない（レビュー指摤16）', () => {
      cardByText('庭を散歩').querySelector('.btn-edit-card').click();
      let form = document.querySelector('#timelineContainer .edit-mode');
      ok(form, '編集フォームが開かない');
      ok(form.querySelector('.edit-text').value === '庭を散歩', '編集対象が「庭を散歩」でない');
      confirmQueue = [true];
      cardByText('朝食をとった').querySelector('.btn-delete').click();
      ok(events.length === 3, '別カードが削除されていない: ' + events.length);
      form = document.querySelector('#timelineContainer .edit-mode');
      ok(form, '別カードの削除で編集フォームが消えた');
      ok(form.querySelector('.edit-text').value === '庭を散歩',
        '編集フォームが別のカードに移った: ' + form.querySelector('.edit-text').value);
      form.querySelector('.edit-text').value = '庭を散歩した';
      form.closest('.timeline-item').querySelector('.compare-edit-save').click();
      ok(events.some(e => e.text === '庭を散歩した'), '編集内容が保存されていない');
      ok(events.some(e => e.text === '書斎で会合'), '無関係なカード（書斎で会合）が上書きされた');
    });

    resetFixture();
    t('T17 キャラ名編集中に別キャラを削除してもズレない（レビュー指摤16キャラ版）', () => {
      const karen = $$('#characterList .char-item').find(r => r.textContent.indexOf('カレン') >= 0);
      karen.querySelector('.btn-edit-char').click();
      let input = document.querySelector('#characterList .char-name-edit');
      ok(input && input.value === 'カレン', 'カレンの編集欄が開かない');
      confirmQueue = [true];
      const alice = $$('#characterList .char-item').find(r => r.textContent.indexOf('アリス') >= 0);
      alice.querySelector('.btn-delete-char').click();
      ok(characters.length === 2, 'アリスが削除されていない: ' + characters.length);
      input = document.querySelector('#characterList .char-name-edit');
      ok(input, '別キャラの削除で編集欄が消えた');
      ok(input.value === 'カレン', '編集欄が別のキャラに移った: ' + input.value);
      input.value = 'カレン改';
      document.querySelector('#characterList .btn-save-char').click();
      ok(characters.some(c => c.name === 'カレン改'), '改名が保存されていない');
      ok(!characters.some(c => c.name === 'カレン'), '旧名が残っている');
      ok(events.some(e => (e.characters || []).indexOf('カレン改') >= 0), 'カードの登場人物名が追従していない');
      ok(characters.some(c => c.name === 'ボブ'), 'ボブが巻き添えで変わった');
    });

    resetFixture();
    t('T18 死亡推定時刻：時だけ選ぶと分が自動で00になる', () => {
      const fh = document.getElementById('deathFromH');
      const fm = document.getElementById('deathFromM');
      fh.value = '21'; fm.value = '';
      onDeathTimeChange();
      ok(fm.value === '00', '分が自動補完されない: "' + fm.value + '"');
      ok((localStorage.getItem(KEYS.deathFrom) || '') === '21:00', '保存値が不正: ' + localStorage.getItem(KEYS.deathFrom));
      fh.value = ''; fm.value = '';
      onDeathTimeChange(); // 後片付け（未設定に戻す）
    });

    resetFixture();
    t('T19 追加欄：Enter素早く2回で追加できる', () => {
      const press = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const ei = document.getElementById('eventInput');
      document.getElementById('timeInput').value = '14:00';
      ei.value = 'Enter追加テスト';
      press(ei); press(ei);
      const added = events.find(e => e.text === 'Enter追加テスト');
      ok(!!added, 'できごと欄のEnter2回でイベントが追加されない');
      ok(added && added.time === '14:00', '時間が保存されない: ' + (added && added.time));
      const ci = document.getElementById('newCharName');
      ci.value = 'エンター増員';
      press(ci); press(ci);
      ok(characters.some(c => c.name === 'エンター増員'), 'キャラ名欄のEnter2回でキャラが追加されない');
    });

    resetFixture();
    t('T20 セッション名：閉じる直前に編集途中を自動保存', () => {
      startSessionNameEdit();
      document.getElementById('sessionNameInput').value = '仮眠前の途中入力';
      window.dispatchEvent(new Event('pagehide'));
      ok((localStorage.getItem(KEYS.sessionName) || '') === '仮眠前の途中入力', '編集途中のセッション名が保存されない: ' + localStorage.getItem(KEYS.sessionName));
      finishSessionNameEdit(); // 後片付け（編集状態を解除）
    });

    t('T12 ID健全性（Phase 1以降のみ）', () => {
      if (typeof genId !== 'function') throw { skip: true, reason: 'まだID未実装（Phase 0では正常）' };
      resetFixture();
      const ids = events.map(e => e.id);
      ok(ids.every(id => typeof id === 'string' && id.length > 0), 'idが付いていないイベントがある');
      ok(new Set(ids).size === ids.length, 'idが重複している');
      document.getElementById('timeInput').value = '13:00';
      document.getElementById('eventInput').value = 'ID確認用';
      document.querySelector('button[onclick="addEvent()"]').click();
      const added = events.find(e => e.text === 'ID確認用');
      ok(added && typeof added.id === 'string' && ids.indexOf(added.id) < 0, '新規イベントのidが不正');
      ok(JSON.parse(localStorage.getItem(KEYS.events)).every(e => e.id), '保存データにidが無いイベントがある');
    });

    resetFixture();
    t('T13 見た目スナップショット（snapHash）', () => {
      const h = snapHash();
      R.meta.snapHash = h;
      const KEY = '__idka_snaphash_baseline__';
      if (window.__IDKA_RESET_BASELINE__) { localStorage.removeItem(KEY); window.__IDKA_RESET_BASELINE__ = false; }
      const base = localStorage.getItem(KEY);
      if (base == null) {
        localStorage.setItem(KEY, String(h));
        R.meta.snapHashNote = '（初回）ベースラインを記録しました';
        return;
      }
      R.meta.snapHashNote = 'ベースライン: ' + base;
      ok(String(h) === base, 'ベースラインと不一致: 記録=' + base + ' 今回=' + h + '（見た目のHTML構造が変わっています）');
    });

  } finally {
    // ---- 後片付け：confirm/alert を元に戻し、あなたのデータを復元 ----
    window.confirm = origConfirm;
    window.alert = origAlert;
    const cur = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('madamisu_') === 0) cur.push(k);
    }
    cur.forEach(k => localStorage.removeItem(k));
    Object.keys(backup).forEach(k => localStorage.setItem(k, backup[k]));
  }

  // ---- レポート ----
  const pass = R.results.filter(r => r.status === 'PASS').length;
  const fail = R.results.filter(r => r.status === 'FAIL').length;
  const skip = R.results.filter(r => r.status === 'SKIP').length;
  const lines = [];
  lines.push('===== ID化テスト レポート =====');
  R.results.forEach(r => lines.push((r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '⏭️' : '❌') + ' ' + r.name + (r.detail ? ' — ' + r.detail : '')));
  lines.push('結果: PASS ' + pass + ' / FAIL ' + fail + ' / SKIP ' + skip);
  if (R.meta.snapHash !== undefined) lines.push('snapHash: ' + R.meta.snapHash + ' ' + (R.meta.snapHashNote || ''));
  if (R.alerts.length) lines.push('⚠️ テスト中のアラート: ' + R.alerts.join(' / '));
  lines.push(fail === 0 ? '判定: 🟢 全テスト合格' : '判定: 🔴 失敗あり — このレポート全文をコピーしてAIに貼り付けてください');
  lines.push('※ページを再読込すると、あなたの元のデータ表示に戻ります');
  const text = lines.join('\n');
  console.log(text);
  window.__IDKA_LAST_REPORT__ = R;
  return text;
})();
