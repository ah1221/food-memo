// 食べたいものメモアプリのメインスクリプト

// localStorage に保存するときのキー
const storageKey = 'foodMemoList';
const viewModeKey = 'foodMemoViewMode';

// 写真リサイズの最大サイズ（px）
const photoMaxSize = 600;
// 写真JPEGの品質（0.0〜1.0）
const photoQuality = 0.75;

// DOM要素の取得
const addForm = document.getElementById('addForm');
const foodInput = document.getElementById('foodInput');
const foodList = document.getElementById('foodList');
const foodTiles = document.getElementById('foodTiles');
const emptyMessage = document.getElementById('emptyMessage');
const remainCount = document.getElementById('remainCount');
const listViewBtn = document.getElementById('listViewBtn');
const tileViewBtn = document.getElementById('tileViewBtn');

// モーダル関連の要素取得
const searchModal = document.getElementById('searchModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalFoodName = document.getElementById('modalFoodName');
const linkGoogleMaps = document.getElementById('linkGoogleMaps');
const storeNameInput = document.getElementById('storeNameInput');
const periodInput = document.getElementById('periodInput');
const priceInput = document.getElementById('priceInput');
const photoPreview = document.getElementById('photoPreview');
const photoInput = document.getElementById('photoInput');
const photoDeleteBtn = document.getElementById('photoDeleteBtn');
const photoSearchBtn = document.getElementById('photoSearchBtn');
const photoUrlInput = document.getElementById('photoUrlInput');
const photoUrlBtn = document.getElementById('photoUrlBtn');
const lookupGoogleBtn = document.getElementById('lookupGoogleBtn');
const lookupPerplexityBtn = document.getElementById('lookupPerplexityBtn');

// メモのデータ配列（{ id, name, eaten, photo, ... } の形式で持つ）
let foods = loadFoods();

// 表示モード（'list' or 'tile'）
let viewMode = localStorage.getItem(viewModeKey) || 'list';
applyViewMode();

// 初期表示
renderList();

// フォーム送信イベント（追加ボタン）
addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = foodInput.value.trim();
  if (name === '') return;

  // 新しいメモを配列の先頭に追加
  const newFood = {
    id: Date.now(),
    name: name,
    storeName: '',
    period: '',
    price: '',
    photo: '',
    favorite: false,
    eaten: false
  };
  foods.unshift(newFood);

  // 保存して再描画
  saveFoods();
  renderList();

  // 入力欄をクリア
  foodInput.value = '';
  foodInput.focus();
});

// 写真URLを該当メモに保存する
function applyPhotoUrl(foodId, photoUrl) {
  foods = foods.map((food) => {
    if (food.id === foodId) {
      return { ...food, photo: photoUrl };
    }
    return food;
  });
  saveFoods();

  // モーダルが該当メモを開いているならプレビューも更新
  if (currentSearchFoodId === foodId) {
    updatePhotoPreview(photoUrl);
  }
  renderList();
}

// 「🔍 画像を探す」ボタン：Google画像検索を新しいタブで開く
photoSearchBtn.addEventListener('click', () => {
  if (currentSearchFoodId === null) return;
  const target = foods.find((food) => food.id === currentSearchFoodId);
  if (!target) return;
  // 食べ物名 + 店名 + 値段 を検索ワードにしてプレスリリース寄りの結果を狙う
  const parts = [target.name];
  if (target.storeName) parts.push(target.storeName);
  const query = parts.join(' ');
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener');
});

// URL貼り付けボタン：入力されたURLを写真として保存
photoUrlBtn.addEventListener('click', () => {
  if (currentSearchFoodId === null) return;
  const inputUrl = photoUrlInput.value.trim();
  if (!inputUrl) {
    alert('画像URLを貼り付けてください');
    return;
  }
  // 簡易バリデーション：http/https で始まること
  if (!/^https?:\/\//i.test(inputUrl)) {
    alert('http:// または https:// で始まるURLを入力してください');
    return;
  }
  applyPhotoUrl(currentSearchFoodId, inputUrl);
  photoUrlInput.value = '';
});

// Enterキーでも貼り付けボタンと同じ動作にする
photoUrlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    photoUrlBtn.click();
  }
});

// リスト・タイル両方を画面に表示する
function renderList() {
  // いったん空にする
  foodList.innerHTML = '';
  foodTiles.innerHTML = '';

  // 何もないときはメッセージを表示
  if (foods.length === 0) {
    emptyMessage.classList.remove('hidden');
  } else {
    emptyMessage.classList.add('hidden');
  }

  // 残りの個数を表示（食べていないものの数）
  const notEatenCount = foods.filter((food) => !food.eaten).length;
  remainCount.textContent = notEatenCount;

  // お気に入りを先頭に並べ替えた配列を作る（元の順番は維持）
  const sortedFoods = [...foods].sort((a, b) => {
    if (a.favorite === b.favorite) return 0;
    return a.favorite ? -1 : 1;
  });

  // 各メモを描画
  sortedFoods.forEach((food) => {
    foodList.appendChild(createListItem(food));
    foodTiles.appendChild(createTileItem(food));
  });
}

// リスト1件分の<li>を作る
function createListItem(food) {
  const li = document.createElement('li');
  li.className = 'foodItem';
  if (food.eaten) {
    li.classList.add('eaten');
  }
  if (food.favorite) {
    li.classList.add('favorite');
  }

  // 写真があれば左にサムネイル表示
  if (food.photo) {
    const thumb = document.createElement('img');
    thumb.className = 'listThumb';
    thumb.src = food.photo;
    thumb.alt = food.name;
    // 読み込み失敗したらサムネ自体を消す
    thumb.addEventListener('error', () => thumb.remove());
    li.appendChild(thumb);
  }

  // 食べ物の名前と店名をまとめるブロック
  const textBlock = document.createElement('div');
  textBlock.className = 'foodText';

  // 食べ物の名前
  const nameSpan = document.createElement('span');
  nameSpan.className = 'foodName';
  nameSpan.textContent = food.name;
  textBlock.appendChild(nameSpan);

  // 期間・値段・場所を必ず表示するブロック
  const metaBlock = createMetaBlock(food);
  textBlock.appendChild(metaBlock);

  // Google Maps への直リンクをインラインで貼る
  const quickLinks = document.createElement('div');
  quickLinks.className = 'quickLinks';
  // Maps検索は「料理名 + 店名」で行うとお店にヒットしやすい
  const mapsQuery = food.storeName ? `${food.name} ${food.storeName}` : food.name;
  const mapsLink = document.createElement('a');
  mapsLink.className = 'quickLink';
  mapsLink.href = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;
  mapsLink.target = '_blank';
  mapsLink.rel = 'noopener';
  mapsLink.textContent = '🗺️ Mapsで開く';
  quickLinks.appendChild(mapsLink);
  textBlock.appendChild(quickLinks);

    // お気に入りボタン
    const favBtn = document.createElement('button');
    favBtn.className = 'iconBtn favBtn';
    favBtn.title = food.favorite ? 'お気に入り解除' : 'お気に入り登録';
    favBtn.textContent = food.favorite ? '⭐' : '☆';
    favBtn.addEventListener('click', () => toggleFavorite(food.id));

    // お店検索ボタン
    const searchBtn = document.createElement('button');
    searchBtn.className = 'iconBtn searchBtn';
    searchBtn.title = 'お店を探す';
    searchBtn.textContent = '🔍';
    searchBtn.addEventListener('click', () => openSearchModal(food.id, food.name));

    // 食べた！ボタン
    const eatBtn = document.createElement('button');
    eatBtn.className = 'iconBtn eatBtn';
    eatBtn.title = food.eaten ? '食べてないに戻す' : '食べた！';
    eatBtn.textContent = food.eaten ? '↩️' : '✅';
    eatBtn.addEventListener('click', () => toggleEaten(food.id));

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'iconBtn deleteBtn';
    deleteBtn.title = '削除';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => deleteFood(food.id));

  li.appendChild(textBlock);
  li.appendChild(favBtn);
  li.appendChild(searchBtn);
  li.appendChild(eatBtn);
  li.appendChild(deleteBtn);
  return li;
}

// 期間・値段・場所をまとめて表示するブロックを作る
// 値が空の項目には「-」を入れて、常に3行とも見えるようにする
function createMetaBlock(food) {
  const wrap = document.createElement('div');
  wrap.className = 'metaBlock';

  const items = [
    { icon: '🏷️', label: '期間', value: food.period },
    { icon: '💴', label: '値段', value: food.price },
    { icon: '📍', label: '場所', value: food.storeName }
  ];

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'metaRow';
    if (!item.value) row.classList.add('metaEmpty');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'metaLabel';
    labelSpan.textContent = `${item.icon} ${item.label}`;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'metaValue';
    valueSpan.textContent = item.value ? item.value : '未設定';

    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    wrap.appendChild(row);
  });

  return wrap;
}

// タイル1件分の要素を作る
function createTileItem(food) {
  const tile = document.createElement('div');
  tile.className = 'foodTile';
  if (food.eaten) tile.classList.add('eaten');
  if (food.favorite) tile.classList.add('favorite');
  // タイル全体をクリックすると検索モーダルが開く
  tile.addEventListener('click', () => openSearchModal(food.id, food.name));

  // 写真エリア
  const photoArea = document.createElement('div');
  photoArea.className = 'tilePhoto';
  if (food.photo) {
    const img = document.createElement('img');
    img.src = food.photo;
    img.alt = food.name;
    // 失敗したら絵文字に切り替え
    img.addEventListener('error', () => {
      img.remove();
      photoArea.textContent = '🍴';
    });
    photoArea.appendChild(img);
  } else {
    // 写真がないときは絵文字プレースホルダ
    photoArea.textContent = '🍴';
  }
  tile.appendChild(photoArea);

  // お気に入りバッジ
  if (food.favorite) {
    const favBadge = document.createElement('div');
    favBadge.className = 'tileFav';
    favBadge.textContent = '⭐';
    tile.appendChild(favBadge);
  }

  // 期間限定バッジ（対象期間が設定されている場合）
  if (food.period) {
    const periodBadge = document.createElement('div');
    periodBadge.className = 'tileBadge';
    periodBadge.textContent = '期間限定';
    tile.appendChild(periodBadge);
  }

  // テキスト部分
  const text = document.createElement('div');
  text.className = 'tileText';

  const tileName = document.createElement('div');
  tileName.className = 'tileName';
  tileName.textContent = food.name;
  text.appendChild(tileName);

  // 期間・値段・場所をまとめて表示（必ず3行表示）
  text.appendChild(createMetaBlock(food));

  tile.appendChild(text);
  return tile;
}

// 表示モードを画面に反映する
function applyViewMode() {
  if (viewMode === 'tile') {
    foodList.classList.add('hidden');
    foodTiles.classList.remove('hidden');
    listViewBtn.classList.remove('active');
    tileViewBtn.classList.add('active');
  } else {
    foodList.classList.remove('hidden');
    foodTiles.classList.add('hidden');
    listViewBtn.classList.add('active');
    tileViewBtn.classList.remove('active');
  }
}

// 表示モード切替
function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem(viewModeKey, mode);
  applyViewMode();
}

listViewBtn.addEventListener('click', () => setViewMode('list'));
tileViewBtn.addEventListener('click', () => setViewMode('tile'));

// お気に入り状態を切り替える
function toggleFavorite(id) {
  foods = foods.map((food) => {
    if (food.id === id) {
      return { ...food, favorite: !food.favorite };
    }
    return food;
  });
  saveFoods();
  renderList();
}

// 食べた状態を切り替える
function toggleEaten(id) {
  foods = foods.map((food) => {
    if (food.id === id) {
      return { ...food, eaten: !food.eaten };
    }
    return food;
  });
  saveFoods();
  renderList();
}

// メモを削除する
function deleteFood(id) {
  // 確認ダイアログ
  if (!confirm('このメモを削除しますか？')) return;
  foods = foods.filter((food) => food.id !== id);
  saveFoods();
  renderList();
}

// localStorage に保存する
function saveFoods() {
  localStorage.setItem(storageKey, JSON.stringify(foods));
}

// 現在モーダルで開いているメモのID（店名保存に使う）
let currentSearchFoodId = null;

// お店検索モーダルを開く
function openSearchModal(foodId, foodName) {
  // どのメモを操作中か覚えておく
  currentSearchFoodId = foodId;

  // 食べ物名を表示にセット
  modalFoodName.textContent = foodName;

  // Maps検索URLを生成（料理名 + 店名 でヒット精度UP）
  const targetForMaps = foods.find((food) => food.id === foodId);
  const mapsQuery = targetForMaps && targetForMaps.storeName
    ? `${foodName} ${targetForMaps.storeName}`
    : foodName;
  linkGoogleMaps.href = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

  // 既に保存されている内容を各入力欄に反映
  const targetFood = foods.find((food) => food.id === foodId);
  storeNameInput.value = targetFood && targetFood.storeName ? targetFood.storeName : '';
  periodInput.value = targetFood && targetFood.period ? targetFood.period : '';
  priceInput.value = targetFood && targetFood.price ? targetFood.price : '';

  // 写真プレビューを更新
  updatePhotoPreview(targetFood && targetFood.photo ? targetFood.photo : '');

  // モーダルを表示
  searchModal.classList.remove('hidden');
}

// プレビューエリアを更新する
function updatePhotoPreview(photoData) {
  photoPreview.innerHTML = '';
  if (photoData) {
    const img = document.createElement('img');
    img.src = photoData;
    img.alt = 'プレビュー';
    photoPreview.appendChild(img);
    photoDeleteBtn.classList.remove('hidden');
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'photoPlaceholder';
    placeholder.textContent = '📷 写真がまだありません';
    photoPreview.appendChild(placeholder);
    photoDeleteBtn.classList.add('hidden');
  }
}

// ファイル選択 → リサイズして保存
photoInput.addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || currentSearchFoodId === null) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // 縦横比を保ったまま最大サイズに収める
      let width = img.width;
      let height = img.height;
      if (width > height && width > photoMaxSize) {
        height = Math.round(height * (photoMaxSize / width));
        width = photoMaxSize;
      } else if (height > photoMaxSize) {
        width = Math.round(width * (photoMaxSize / height));
        height = photoMaxSize;
      }

      // canvasに描いてJPEGで再エンコード
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', photoQuality);

      // データを保存
      savePhoto(dataUrl);
    };
    img.onerror = () => {
      alert('画像の読み込みに失敗しました');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // 同じファイルを再選択できるようにinputをリセット
  event.target.value = '';
});

// 写真をデータに保存
function savePhoto(dataUrl) {
  foods = foods.map((food) => {
    if (food.id === currentSearchFoodId) {
      return { ...food, photo: dataUrl };
    }
    return food;
  });
  try {
    saveFoods();
  } catch (error) {
    // 容量オーバー時のエラー処理
    alert('保存容量を超えました。古い写真を削除するか、画像サイズを小さくしてください。');
    return;
  }
  updatePhotoPreview(dataUrl);
  renderList();
}

// 写真を削除
photoDeleteBtn.addEventListener('click', () => {
  if (currentSearchFoodId === null) return;
  if (!confirm('この写真を削除しますか？')) return;
  foods = foods.map((food) => {
    if (food.id === currentSearchFoodId) {
      return { ...food, photo: '' };
    }
    return food;
  });
  saveFoods();
  updatePhotoPreview('');
  renderList();
});

// 店名・対象期間・値段を自動保存する
function saveStoreDetails(triggerElement) {
  if (currentSearchFoodId === null) return;

  // 各入力欄の値を取り出す
  const newStoreName = storeNameInput.value.trim();
  const newPeriod = periodInput.value.trim();
  const newPrice = priceInput.value.trim();

  // 対象のメモを更新
  foods = foods.map((food) => {
    if (food.id === currentSearchFoodId) {
      return { ...food, storeName: newStoreName, period: newPeriod, price: newPrice };
    }
    return food;
  });

  // 保存と再描画（モーダルは閉じない）
  saveFoods();
  renderList();

  // 緑色フラッシュで保存を視覚的に伝える（変更があった欄に出す）
  const target = triggerElement || storeNameInput;
  target.classList.add('savedFlash');
  clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => {
    target.classList.remove('savedFlash');
  }, 600);
}

// 保存フラッシュのタイマー保持用
let saveFlashTimer = null;

// モーダルを閉じる
function closeSearchModal() {
  searchModal.classList.add('hidden');
}

// 閉じるボタンのイベント
modalCloseBtn.addEventListener('click', closeSearchModal);

// 入力した瞬間に自動保存（タイピングごとに保存）
storeNameInput.addEventListener('input', () => saveStoreDetails(storeNameInput));
periodInput.addEventListener('input', () => saveStoreDetails(periodInput));
priceInput.addEventListener('input', () => saveStoreDetails(priceInput));

// Mapsリンクをクリックしたら、その時点の入力内容を保存
linkGoogleMaps.addEventListener('click', () => saveStoreDetails(storeNameInput));

// 🔍 Google検索：「料理名 期間限定 値段 店舗」のスマート検索を新タブで開く
lookupGoogleBtn.addEventListener('click', () => {
  if (currentSearchFoodId === null) return;
  const target = foods.find((food) => food.id === currentSearchFoodId);
  if (!target) return;
  const query = `${target.name} 期間限定 値段 店舗 メニュー`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener');
});

// 🤖 Perplexity AI：質問文を投げて回答を直接表示してもらう
lookupPerplexityBtn.addEventListener('click', () => {
  if (currentSearchFoodId === null) return;
  const target = foods.find((food) => food.id === currentSearchFoodId);
  if (!target) return;
  const question = `${target.name}という商品の販売期間、値段、買えるお店を教えて`;
  const url = `https://www.perplexity.ai/?q=${encodeURIComponent(question)}`;
  window.open(url, '_blank', 'noopener');
});

// オーバーレイ部分をクリックでも閉じる
searchModal.addEventListener('click', (event) => {
  if (event.target === searchModal) {
    closeSearchModal();
  }
});

// ESCキーでも閉じる
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !searchModal.classList.contains('hidden')) {
    closeSearchModal();
  }
});

// localStorage から読み込む
function loadFoods() {
  const data = localStorage.getItem(storageKey);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    // 読み込み失敗時は空にする
    return [];
  }
}
