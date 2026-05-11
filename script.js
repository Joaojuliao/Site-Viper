// ════════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO — só mexa aqui
// ════════════════════════════════════════════════════════════════


const SHEET_ID = '1LvNA4Nq9uB7W3wezmRL-zYBTl2jj-qE3y4lXO79FwZs';

/*
  ESTRUTURA DA PLANILHA (primeira linha = cabeçalho exato):
  ┌──────────┬─────────────┬─────────┬───────────┬─────────────────────┬───────────────┬───────────────────────────────┐
  │  nome    │    data     │ horario │  genero   │     descricao       │ foto_drive_id │        link_ingresso          │
  ├──────────┼─────────────┼─────────┼───────────┼─────────────────────┼───────────────┼───────────────────────────────┤
  │ DJ Night │ Sexta-feira │  23:00  │ Eletrônico│ Os melhores DJs...  │ 1aBcDeF_xyz   │ https://minha-entrada.com.br/ │
  └──────────┴─────────────┴─────────┴───────────┴─────────────────────┴───────────────┴───────────────────────────────┘

  foto_drive_id → apenas o ID (ex: 1aBcDeF_xyz), não a URL completa
  link_ingresso → URL completa do evento no Minha Entrada
  Linhas com "nome" vazio são ignoradas automaticamente
*/

// ════════════════════════════════════════════════════════════════
//  HAMBURGER
// ════════════════════════════════════════════════════════════════
const ham = document.getElementById('hamburger');
const mob = document.getElementById('mobile-menu');

ham.addEventListener('click', () => {
  const isOpen = mob.classList.toggle('open');
  ham.setAttribute('aria-expanded', isOpen);
  const spans = ham.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'translateY(7px) rotate(45deg)';
    spans[1].style.opacity   = '0';
    spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
mob.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mob.classList.remove('open');
  ham.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}));

// ════════════════════════════════════════════════════════════════
//  SCROLL REVEAL
// ════════════════════════════════════════════════════════════════
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 90);
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ════════════════════════════════════════════════════════════════
//  HEADER SHADOW
// ════════════════════════════════════════════════════════════════
const hdr = document.getElementById('site-header');
window.addEventListener('scroll', () => {
  hdr.style.boxShadow = window.scrollY > 10 ? '0 2px 24px rgba(0,0,0,.5)' : 'none';
});

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
//  EVENTOS — GOOGLE SHEETS
//  Colunas: nome | data | dia_da_semana | horario | genero |
//           descricao | foto_drive_id | link_ingresso | ativo
//  Apenas linhas com ativo = "sim" são exibidas.
// ════════════════════════════════════════════════════════════════
(function loadEvents() {
  const grid    = document.getElementById('events-grid');
  const loading = document.getElementById('events-loading');
  const errBox  = document.getElementById('events-error');

  const cbName = '__viperSheetCb';

  // ── Handler principal — processa o JSON da planilha ──
  function handleData(json) {
    cleanup();
    try {
      const cols = (json.table.cols || []).map(c =>
        (c.label || '').toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
      );
      const rows = json.table.rows || [];

      function ci(name) { return cols.indexOf(name); }
      function cell(row, idx) {
        if (idx < 0 || !row.c || !row.c[idx]) return '';
        const c = row.c[idx];
        return (c.f != null ? c.f : c.v != null ? c.v : '').toString().trim();
      }

      const eventos = rows
        .map(row => ({
          nome:          cell(row, ci('nome')),
          data:          cell(row, ci('data')),
          dia_da_semana: cell(row, ci('dia_da_semana')),
          horario:       cell(row, ci('horario')),
          genero:        cell(row, ci('genero')),
          descricao:     cell(row, ci('descricao')),
          foto_drive_id: cell(row, ci('foto_drive_id')),
          link_ingresso: cell(row, ci('link_ingresso')),
          ativo:         cell(row, ci('ativo')),
        }))
        .filter(e => e.nome && e.ativo.toLowerCase() === 'sim');

      if (eventos.length === 0) {
        loading.style.display = 'none';
        document.getElementById('programacao').style.display = 'none';
        return;
      }
      renderEvents(eventos);
    } catch (err) {
      showError(err);
    }
  }

  // ── Duplo registro do callback:
  //    Às vezes o Google chama nossa função pelo nome,
  //    às vezes chama google.visualization.Query.setResponse()
  //    — cobrimos os dois casos. ──
  window[cbName] = handleData;

  window.google = window.google || {};
  window.google.visualization = window.google.visualization || {};
  window.google.visualization.Query = window.google.visualization.Query || {};
  window.google.visualization.Query.setResponse = function(json) {
    window[cbName](json);
  };

  const timer = setTimeout(() => {
    cleanup();
    showError('Timeout — verifique se a planilha está pública.');
  }, 10000);

  function cleanup() {
    clearTimeout(timer);
    delete window[cbName];
    const old = document.getElementById('viper-sheet-script');
    if (old) old.remove();
  }

  function showError(msg) {
    console.warn('[Viper] Eventos:', msg);
    loading.style.display = 'none';
    errBox.style.display  = 'flex';
  }

  // ── Injeta <script> JSONP — nunca bloqueado por CORS ──
  const s = document.createElement('script');
  s.id    = 'viper-sheet-script';
  s.src   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&callback=${cbName}&headers=1`;
  s.onerror = () => { cleanup(); showError('Erro ao carregar script da planilha.'); };
  document.head.appendChild(s);

  // ── Escapa HTML ──
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderEvents(eventos) {
    loading.style.display = 'none';
    grid.style.display    = 'grid';

    grid.innerHTML = eventos.map(e => {
      const imgSrc  = e.foto_drive_id
        ? `https://drive.google.com/thumbnail?id=${e.foto_drive_id}&sz=w800`
        : '';
      const badge   = [e.dia_da_semana, e.data, e.horario].filter(Boolean).join(' · ');
      const linkUrl = e.link_ingresso || 'https://www.minha-entrada.com.br/';

      return `
        <a href="${esc(linkUrl)}" target="_blank" rel="noopener" class="ecard-new reveal">
          <div class="ecard-img-wrap${imgSrc ? '' : ' ecard-img-fallback'}">
            ${imgSrc
              ? `<img src="${esc(imgSrc)}" alt="${esc(e.nome)}" class="ecard-img" loading="lazy"
                   onerror="this.parentElement.classList.add('ecard-img-fallback');this.remove();">`
              : ''}
            <div class="ecard-img-overlay"></div>
            ${badge ? `<span class="ecard-badge">${esc(badge)}</span>` : ''}
          </div>
          <div class="ecard-body">
            ${e.genero    ? `<span class="ecard-tag">${esc(e.genero)}</span>`  : ''}
            <h3 class="ecard-name">${esc(e.nome)}</h3>
            ${e.descricao ? `<p class="ecard-desc">${esc(e.descricao)}</p>`    : ''}
            <div class="ecard-cta">
              <span class="ecard-buy"><i class="ri-ticket-2-fill"></i> Comprar Ingresso</span>
              <i class="ri-arrow-right-up-long-line"></i>
            </div>
          </div>
        </a>`;
    }).join('');

    grid.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }
})();
// ════════════════════════════════════════════════════════════════
//  GALERIA — lê subpastas automaticamente do Google Drive
//
//  ÚNICO passo de configuração:
//  Após fazer deploy do apps-script.gs, cole a URL abaixo:
// ════════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRuoTcrLskksP3-AxJQjiH1J14ZDBiNEoxFnzwRzQPWAkXO53R_cu-E4EPlwRhuE_Q9Q/exec';

(function () {

  // Elementos fixos do DOM
  const tabsContainer = document.getElementById('gallery-tabs');
  const wrap          = document.getElementById('gallery-scroll-wrap');
  const gridsArea     = document.getElementById('gallery-grids');
  const loadingEl     = document.getElementById('gallery-loading');
  const hintEl        = document.getElementById('gallery-hint');

  // Estado
  const photoCache = {};   // { "2024": [id, id, ...] }
  let   activeYear = null;

  // ── Padrão assimétrico de layout (repete a cada 9 fotos) ──
  const LAYOUT = ['tall','n','n','n','wide','n','tall','n','n'];

  // ════ 1. Busca a lista de subpastas (action=list) ════════════

  function fetchFolders() {
    const cb = '__viperFoldersCb';
    const timer = setTimeout(() => {
      cleanup(); showError('Timeout ao carregar pastas.');
    }, 10000);

    function cleanup() {
      clearTimeout(timer); delete window[cb];
      const s = document.getElementById('viper-folders-script');
      if (s) s.remove();
    }

    window[cb] = function (data) {
      cleanup();
      if (!data.ok || !data.folders || !data.folders.length) {
        showError(data.error || 'Nenhuma pasta encontrada.');
        return;
      }
      buildTabs(data.folders);
    };

    const s = document.createElement('script');
    s.id  = 'viper-folders-script';
    s.src = `${APPS_SCRIPT_URL}?action=list&callback=${cb}`;
    s.onerror = () => { cleanup(); showError('Falha ao conectar com o Drive.'); };
    document.head.appendChild(s);
  }

  // ════ 2. Cria as abas dinamicamente ════════════════════════════

  function buildTabs(folders) {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    folders.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'gtab' + (i === 0 ? ' active' : '');
      btn.dataset.year = name;
      btn.textContent  = name;
      btn.addEventListener('click', () => switchTab(name));
      tabsContainer.appendChild(btn);

      // Cria o grid vazio para cada pasta
      if (gridsArea) {
        const grid = document.createElement('div');
        grid.className = 'gallery-year-grid' + (i === 0 ? ' active' : '');
        grid.dataset.year = name;
        grid.id = 'grid-' + name;
        gridsArea.appendChild(grid);
      }
    });

    // Mostra o container e carrega a primeira pasta
    if (loadingEl) loadingEl.style.display = 'none';
    if (wrap)      wrap.style.display      = '';
    if (hintEl)    hintEl.style.display    = 'flex';

    activeYear = folders[0];
    fetchPhotos(folders[0]);

    // Pré-carrega as demais em background após 1.5s
    setTimeout(() => {
      folders.slice(1).forEach(f => fetchPhotos(f));
    }, 1500);
  }

  // ════ 3. Busca fotos de uma pasta (action=photos) ═══════════════

  function fetchPhotos(folderName) {
    if (photoCache[folderName]) {
      renderGrid(folderName, photoCache[folderName]);
      return;
    }

    const cb = `__viperPhotosCb_${folderName.replace(/\W/g,'_')}`;
    const timer = setTimeout(() => {
      cleanup(); renderFallback(folderName);
    }, 10000);

    function cleanup() {
      clearTimeout(timer); delete window[cb];
      const s = document.getElementById('viper-photos-' + folderName);
      if (s) s.remove();
    }

    window[cb] = function (data) {
      cleanup();
      const ids = (data.ok && data.photos) ? data.photos : [];
      photoCache[folderName] = ids;
      renderGrid(folderName, ids);
    };

    const s = document.createElement('script');
    s.id  = 'viper-photos-' + folderName;
    s.src = `${APPS_SCRIPT_URL}?action=photos&folder=${encodeURIComponent(folderName)}&callback=${cb}`;
    s.onerror = () => { cleanup(); renderFallback(folderName); };
    document.head.appendChild(s);
  }

  // ════ 4. Renderiza o grid de fotos ══════════════════════════════

  function renderGrid(folderName, ids) {
    const grid = document.getElementById('grid-' + folderName);
    if (!grid) return;

    if (!ids.length) { renderFallback(folderName); return; }

    grid.innerHTML = ids.map((id, i) => {
      const pat = LAYOUT[i % LAYOUT.length];
      const cls = pat === 'tall' ? 'gphoto gphoto--tall'
                : pat === 'wide' ? 'gphoto gphoto--wide'
                : 'gphoto';
      const sz  = (pat === 'tall' || pat === 'wide') ? 'w1200' : 'w800';
      return `
        <div class="${cls}">
          <img src="https://drive.google.com/thumbnail?id=${id}&sz=${sz}"
               alt="Viper · ${folderName}" loading="lazy"
               onerror="this.parentElement.classList.add('gphoto-fallback');this.remove()">
          <div class="gphoto-overlay">
            <div class="gphoto-zoom"><i class="ri-zoom-in-line"></i></div>
            <span>Viper · ${folderName}</span>
          </div>
        </div>`;
    }).join('');

    // Registra cliques para o modal
    const imgs = Array.from(grid.querySelectorAll('img'));
    grid.querySelectorAll('.gphoto').forEach((card, i) => {
      card.addEventListener('click', () => openModal(imgs, i));
    });
  }

  // Placeholder visual quando não há fotos
  function renderFallback(folderName) {
    const grid = document.getElementById('grid-' + folderName);
    if (!grid) return;
    grid.innerHTML = LAYOUT.slice(0, 6).map(p => {
      const cls = p === 'tall' ? 'gphoto gphoto--tall gphoto-fallback'
                : p === 'wide' ? 'gphoto gphoto--wide gphoto-fallback'
                : 'gphoto gphoto-fallback';
      return `<div class="${cls}"></div>`;
    }).join('');
  }

  function showError(msg) {
    console.warn('[Viper Galeria]', msg);
    if (loadingEl) {
      loadingEl.innerHTML = `<p style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;letter-spacing:.2em;font-size:.8rem;text-transform:uppercase;">Galeria indisponível</p>`;
    }
  }

  // ════ 5. Troca de aba ════════════════════════════════════════════

  function switchTab(name) {
    activeYear = name;

    // Atualiza botões
    document.querySelectorAll('.gtab').forEach(t => {
      t.classList.toggle('active', t.dataset.year === name);
    });

    // Atualiza grids
    document.querySelectorAll('.gallery-year-grid').forEach(g => {
      g.classList.toggle('active', g.dataset.year === name);
    });

    // Sobe o scroll
    if (wrap) wrap.scrollTop = 0;

    // Garante que as fotos estejam carregadas
    fetchPhotos(name);
  }

  // ════ MODAL ══════════════════════════════════════════════════════

  const modal    = document.getElementById('gmodal');
  const backdrop = document.getElementById('gmodal-backdrop');
  const mImg     = document.getElementById('gmodal-img');
  const mClose   = document.getElementById('gmodal-close');
  const mPrev    = document.getElementById('gmodal-prev');
  const mNext    = document.getElementById('gmodal-next');
  const mCur     = document.getElementById('gmodal-cur');
  const mTotal   = document.getElementById('gmodal-total');
  const mDots    = document.getElementById('gmodal-dots');

  let modalPhotos = [];
  let modalIndex  = 0;

  function buildDots(count, active) {
    if (!mDots) return;
    mDots.innerHTML = '';
    const max = Math.min(count, 16);
    for (let i = 0; i < max; i++) {
      const d = document.createElement('button');
      d.className = 'gmodal-dot' + (i === active ? ' active' : '');
      d.setAttribute('aria-label', 'Foto ' + (i + 1));
      d.addEventListener('click', () => goTo(i));
      mDots.appendChild(d);
    }
  }

  function openModal(photos, index) {
    if (!modal) return;
    modalPhotos = photos.filter(img => img && img.src && img.naturalWidth !== 0);
    if (!modalPhotos.length) modalPhotos = photos;
    goTo(index >= modalPhotos.length ? 0 : index);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (mImg) mImg.src = ''; }, 350);
  }

  function goTo(index) {
    if (!modalPhotos.length) return;
    if (index < 0) index = modalPhotos.length - 1;
    if (index >= modalPhotos.length) index = 0;
    modalIndex = index;
    const img = modalPhotos[index];
    if (mImg) {
      mImg.src = (img.src || '').replace(/sz=w\d+/, 'sz=w1600');
      mImg.alt = img.alt || 'Foto Viper';
    }
    if (mCur)   mCur.textContent   = index + 1;
    if (mTotal) mTotal.textContent = modalPhotos.length;
    buildDots(modalPhotos.length, index);
  }

  if (mClose)   mClose.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (mPrev)    mPrev.addEventListener('click', () => goTo(modalIndex - 1));
  if (mNext)    mNext.addEventListener('click', () => goTo(modalIndex + 1));

  document.addEventListener('keydown', e => {
    if (!modal || !modal.classList.contains('open')) return;
    if (e.key === 'Escape')     { e.preventDefault(); closeModal(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(modalIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(modalIndex + 1); }
  });

  let touchStartX = 0;
  if (modal) {
    modal.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    modal.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) goTo(modalIndex + (dx < 0 ? 1 : -1));
    });
  }

  // ════ Inicia ════════════════════════════════════════════════════
  fetchFolders();

})();
