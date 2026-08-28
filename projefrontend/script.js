// =========================================================================
// GLOBAL DEĞİŞKENLER VE DURUM YÖNETİMİ (STATE)
// =========================================================================

// Kategori bazlı ürün listeleri
let kitaplar = [];
let elektronikler = [];
let hobi = [];
let kirtasiye = [];
let tumUrunler = []; // Sayfalama ve genel filtreleme için tüm ürünleri tutacak dizi

// URL üzerindeki arama/filtreleme parametrelerini yakalama (örn: ?marka=JBL)
const params = new URLSearchParams(window.location.search);
const marka = params.get("marka");

// Sayfalama (Pagination) ayarları
const pagination = document.getElementById("pagination");
const URUN_SAYISI = 36; // Sayfa başına gridde gösterilecek maksimum ürün sayısı
let aktifSayfa = 1;

// =========================================================================
// 1. API VERİ ÇEKME İŞLEMLERİ (ÜRÜNLER VE İNDİRİMLİLER)
// =========================================================================

/**
 * Backend'deki /api/genel/indirimli endpoint'ine istek atarak indirimli ürünleri çeker
 * ve ekrandaki diğer gridleri gizleyip sadece indirimli gridi render eder.
 */
// API İşlemleri
async function indirimliUrunleriGetir() {

    try {

        const response = await fetch(
            "http://localhost:5192/api/genel/indirimli"
        );

        if (!response.ok) {
            throw new Error("Veri çekilemedi!");
        }

        const data = await response.json();

        console.log("İndirimli Ürünler:", data);

        // Ürün alanları
        const indirimliGrid = document.getElementById("indirimliGrid");

        // Alan yoksa oluştur
        if (!indirimliGrid) {
            console.error("indirimliGrid bulunamadı!");
            return;
        }

        // Diğer ürünleri gizle
        document.getElementById("kitaplarGrid")?.style.setProperty("display", "none");
        document.getElementById("elektronikGrid")?.style.setProperty("display", "none");
        document.getElementById("hobi")?.style.setProperty("display", "none");
        document.getElementById("kirtasiye")?.style.setProperty("display", "none");
        document.getElementById("aramaSonuclari")?.style.setProperty("display", "none");
        document.getElementById("pagination")?.style.setProperty("display", "none");

        // İndirimli ürünleri göster
        indirimliGrid.style.display = "grid";

        // Önce temizle
        indirimliGrid.innerHTML = "";

        // Ürün yoksa
        if (data.length === 0) {

            indirimliGrid.innerHTML = `
                <p>İndirimli ürün bulunamadı.</p>
            `;

            return;
        }

        // Ürünleri kart olarak bas
        const indirimliUrunler = data.filter(urun =>
            urun.indirimlifiyat !== null &&
            urun.indirimlifiyat !== undefined &&
            urun.indirimlifiyat !== ""
        );

        indirimliUrunler.forEach(urun => {
            ekranaKartBas(urun, indirimliGrid);
        });

    } catch (error) {

        console.error("İndirimli ürün hatası:", error);

    }
}

/**
 * Tüm ürün kataloğunu backend API'den çeker, kategorilere göre ayırır ve ilk sayfayı render eder.
 */
async function urunleriGetir() {
    try {
        const response = await fetch("http://localhost:5192/api/genel?kelime=");
        if (!response.ok) throw new Error("Veri çekilemedi!");

        const data = await response.json();
        tumUrunler = data;

        // Kategori bazlı dizi filtrelemeleri
        kitaplar = data.filter(urun => urun.kategori?.toLowerCase() === "kitaplar");
        elektronikler = data.filter(urun => urun.kategori?.toLowerCase() === "elektronik");
        rastgeleElektronikSliderOlustur(); // Ana sayfadaki önerilenler slider'ını tetikler
        hobi = data.filter(urun => urun.kategori?.toLowerCase() === "hobi");
        kirtasiye = data.filter(urun => urun.kategori?.toLowerCase() === "kirtasiye");


        sayfayiGuncelle(1);

    } catch (error) {
        console.error("Hata:", error);
    }
}

// =========================================================================
// 2. SAYFALAMA (PAGINATION) VE GÖRÜNÜM GÜNCELLEME MOTORU
// =========================================================================

// Sayfa değiştiğinde verileri ve butonları güncelleyen ana fonksiyon
function sayfayiGuncelle(sayfa) {

    // Marka filtresi aktifken genel kategori sayfalamasını ezmemesi için durdurur
    if (markaFiltresiAktif) {
        return;
    }
    aktifSayfa = sayfa;
    kitaplariGoster();
    elektronikleriGoster();
    hobiGoster();
    kirtasiyegoster();
    sayfalamaOlustur();
}

// =========================================================================
// 3. SLIDER VE SAYFA GEÇİŞ KONTROLLERİ
// =========================================================================

// Slider Kontrolleri
const sliderTrack = document.getElementById("sliderTrack");
const slideLeft = document.getElementById("slideLeft");
const slideRight = document.getElementById("slideRight");

// Kategori slider butonlarına yumuşak kaydırma (smooth scroll) olayı ekleme
if (slideLeft && slideRight && sliderTrack) {
    slideLeft.addEventListener("click", () => {
        sliderTrack.scrollBy({ left: -300, behavior: "smooth" });
    });

    slideRight.addEventListener("click", () => {
        sliderTrack.scrollBy({ left: 300, behavior: "smooth" });
    });
}

/**
 * Ürün kartına tıklandığında ürünün fotoğraf linkini encode ederek detay sayfasına yönlendirir.
 */
function urunDetayinaGit(urun) {

    const fotolink = encodeURIComponent(urun.fotolink);

    window.location.href =
        `http://localhost:5500/urun-detay.html?fotolink=${fotolink}`;
}

// =========================================================================
// 4. KATEGORİ GRID RENDER FONKSİYONLARI (KİTAP, ELEKTRONİK, HOBİ, KIRTASİYE)
// =========================================================================

/**
 * Kitaplar kategorisine ait ürünleri aktif sayfa aralığına (slice) göre DOM'a basar.
 */
function kitaplariGoster() {
    const grid = document.getElementById("kitaplarGrid");
    if (!grid) return;

    grid.innerHTML = "";

    // Sayfalama sınırlarını hesaplama
    const baslangic = (aktifSayfa - 1) * URUN_SAYISI;
    const bitis = baslangic + URUN_SAYISI;
    const gosterilecekKitaplar = kitaplar.slice(baslangic, bitis);

    gosterilecekKitaplar.forEach(urun => {
        const kart = document.createElement("div");
        kart.className = "product-card";
        kart.addEventListener("click", () => {
            urunDetayinaGit(urun);
        });

        // İndirimli fiyat varsa eski fiyatın üzerini çizer
        const fiyatHTML = urun.indirimlifiyat != null
            ? `<span class="indirimli-fiyat">${urun.indirimlifiyat} TL</span>
               <span class="normal-fiyat">${urun.fiyati} TL</span>
               <span class="icon1">🧺</span>`
            : `<span class="indirimli-fiyat">${urun.fiyati} TL</span>`;

        kart.innerHTML = `
            <div class="product-image">
                <img src="${urun.fotolink}" alt="${urun.urun_adi}">
            </div>
            <div class="product-info">
                <div class="product-name">${urun.urun_adi}</div>
                <div class="product-author">${urun.yazar ?? ""}</div>
                <div class="product-publisher">${urun.marka ?? ""}</div>
                <div class="product-price">${fiyatHTML}</div>
                 <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 
            <div class="product-rating">
                        ⭐ ${urun.yildiz_sayisi}
                    </div>
                   <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>
        `;
        grid.appendChild(kart);
    });
}

/**
 * Elektronik kategorisine ait ürünleri aktif sayfa aralığına göre DOM'a basar.
 */
function elektronikleriGoster() {
    const grid = document.getElementById("elektronikGrid");
    if (!grid) return;

    grid.innerHTML = "";

    const baslangic = (aktifSayfa - 1) * URUN_SAYISI;
    const bitis = baslangic + URUN_SAYISI;
    const gosterilecekElektronikler = elektronikler.slice(baslangic, bitis);

    gosterilecekElektronikler.forEach(urun => {
        const kart = document.createElement("div");
        kart.className = "product-card";

        kart.addEventListener("click", () => {
            urunDetayinaGit(urun);
        });

        const fiyatHTML = urun.indirimlifiyat != null
            ? `<span class="indirimli-fiyat">${urun.indirimlifiyat} TL </span>
               <span class="normal-fiyat">${urun.fiyati} </span>
               <span class="icon1">🧺</span>`

            : `<span class="indirimli-fiyat">${urun.fiyati} TL</span>`;

        kart.innerHTML = `
            <div class="product-image">
                <img src="${urun.fotolink}" alt="${urun.urun_adi}">
            </div>
            <div class="product-info">
                <div class="product-name">${urun.urun_adi}</div>
                <div class="product-publisher">${urun.marka ?? ""}</div>
                <div class="product-price">${fiyatHTML}</div>
                 <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 
            <div class="product-rating">
                        ⭐ ${urun.yildiz_sayisi}
                    </div>
                    <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>
        `;
        grid.appendChild(kart);
    });
}

/**
 * Hobi kategorisine ait ürünleri aktif sayfa aralığına göre DOM'a basar.
 */
function hobiGoster() {
    const grid = document.getElementById("hobi");
    if (!grid) return;

    grid.innerHTML = "";

    const baslangic = (aktifSayfa - 1) * URUN_SAYISI;
    const bitis = baslangic + URUN_SAYISI;
    const gosterilecekhobi = hobi.slice(baslangic, bitis);

    gosterilecekhobi.forEach(urun => {
        const kart = document.createElement("div");
        kart.className = "product-card";

        kart.addEventListener("click", () => {
            urunDetayinaGit(urun);
        });

        const fiyatHTML = urun.indirimlifiyat != null
            ? `<span class="indirimli-fiyat">${urun.indirimlifiyat} TL </span>
               <span class="normal-fiyat">${urun.fiyati} </span>
               <span class="icon1">🧺</span>`
            : `<span class="indirimli-fiyat">${urun.fiyati} </span>`;

        kart.innerHTML = `
            <div class="product-image">
                <img src="${urun.fotolink}" alt="${urun.urun_adi}">
            </div>
            <div class="product-info">
                <div class="product-name">${urun.urun_adi}</div>
                <div class="product-publisher">${urun.marka ?? ""}</div>
                <div class="product-price">${fiyatHTML}</div>
                 <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 
            <div class="product-rating">
                        ⭐ ${urun.yildiz_sayisi}
                    </div>
                   <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>
        `;
        grid.appendChild(kart);
    });
}

/**
 * Kırtasiye kategorisine ait ürünleri aktif sayfa aralığına göre DOM'a basar.
 */
function kirtasiyegoster() {
    const grid = document.getElementById("kirtasiye");
    if (!grid) return;

    grid.innerHTML = "";

    const baslangic = (aktifSayfa - 1) * URUN_SAYISI;
    const bitis = baslangic + URUN_SAYISI;
    const gosterilecekirtasiye = kirtasiye.slice(baslangic, bitis);

    gosterilecekirtasiye.forEach(urun => {
        const kart = document.createElement("div");
        kart.className = "product-card";

        kart.addEventListener("click", () => {
            urunDetayinaGit(urun);
        });

        const fiyatHTML = urun.indirimlifiyat != null
            ? `<span class="indirimli-fiyat">${urun.indirimlifiyat} TL</span>
               <span class="normal-fiyat">${urun.fiyati} </span>
               `
            : `<span class="indirimli-fiyat">${urun.fiyati} </span>`;

        kart.innerHTML = `
            <div class="product-image">
                <img src="${urun.fotolink}" alt="${urun.urun_adi}">
            </div>
            <div class="product-info">
                <div class="product-name">${urun.urun_adi}</div>
                <div class="product-publisher">${urun.marka ?? ""}</div>
                <div class="product-price">${fiyatHTML}</div>
                 <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 
            <div class="product-rating">
                        ⭐ ${urun.yildiz_sayisi}
                    </div>
                    <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>
        `;
        grid.appendChild(kart);
    });
}

/**
 * Toplam ürün miktarına göre sayfa butonlarını dinamik olarak oluşturur.
 */
function sayfalamaOlustur() {
    if (!pagination) return;
    pagination.innerHTML = "";

    const enBuyukKategoriUzunlugu = Math.max(kitaplar.length, elektronikler.length, hobi.length, kirtasiye.length);

    const toplamSayfa = Math.ceil(enBuyukKategoriUzunlugu / URUN_SAYISI);

    if (toplamSayfa <= 1) return;


    if (aktifSayfa > 1) {
        const geri = document.createElement("button");
        geri.innerHTML = "‹";
        geri.onclick = () => sayfayiGuncelle(aktifSayfa - 1);
        pagination.appendChild(geri);
    }

    for (let i = 1; i <= toplamSayfa; i++) {
        const buton = document.createElement("button");
        buton.innerText = i;

        if (i === aktifSayfa) {
            buton.classList.add("active");
        }

        buton.onclick = () => {
            sayfayiGuncelle(i);
            const section = document.querySelector(".product-section");
            if (section) {
                section.scrollIntoView({ behavior: "smooth" });
            }
        };

        pagination.appendChild(buton);
    }

    if (aktifSayfa < toplamSayfa) {
        const ileri = document.createElement("button");
        ileri.innerHTML = "›";
        ileri.onclick = () => sayfayiGuncelle(aktifSayfa + 1);
        pagination.appendChild(ileri);
    }
}

// Sayfa ilk yüklendiğinde ürünleri getiren fonksiyonu başlat
urunleriGetir();

// =========================================================================
// 5. MARKA, YAZAR VE HIZLI ARAMA FİLTRELEME MOTORU
// =========================================================================

let seciliMarkalar = [];

// Slider altındaki hızlı arama butonları (.arama-butonu) için dinleyici
document.querySelectorAll(".arama-butonu").forEach(buton => {
    buton.addEventListener("click", async function (e) {
        e.preventDefault();

        const kelime = this.dataset.kelime;
        const aramaGrid = document.getElementById("aramaSonuclari");
        const elektronikGrid = document.getElementById("elektronikGrid");
        const kitaplarGrid = document.getElementById("kitaplarGrid");
        const hobiGrid = document.getElementById("hobi");
        const kirtasiyeGrid = document.getElementById("kirtasiye");
        const pagination = document.getElementById("pagination");

        // Diğer kategori gridlerini gizle
        if (elektronikGrid) elektronikGrid.style.display = "none";
        if (kitaplarGrid) kitaplarGrid.style.display = "none";
        if (hobiGrid) hobiGrid.style.display = "none";
        if (kirtasiyeGrid) kirtasiyeGrid.style.display = "none";
        if (pagination) pagination.style.display = "none";

        aramaGrid.style.display = "grid";
        aramaGrid.innerHTML = "";

        try {
            const response = await fetch(`http://localhost:5192/api/genel?kelime=${encodeURIComponent(kelime)}`);
            if (!response.ok) throw new Error("API isteği başarısız");

            const urunler = await response.json();


            window.sonAramaUrunleri = urunler;


            seciliMarkalar = [];
            document.querySelectorAll("input[data-marka]").forEach(cb => cb.checked = false);

            if (urunler.length === 0) {
                aramaGrid.innerHTML = "<p>Ürün bulunamadı.</p>";
                return;
            }

            urunler.forEach(urun => ekranaKartBas(urun, aramaGrid));

        } catch (error) {
            console.error("Hata:", error);
        }
    });
});

let markaFiltresiAktif = false;

// Marka Checkbox filtreleri dinleyicisi
document.querySelectorAll("input[data-marka]").forEach(checkbox => {
    checkbox.addEventListener("change", function () {

        const aramaGrid = document.getElementById("aramaSonuclari");
        const elektronikGrid = document.getElementById("elektronikGrid");
        const kitaplarGrid = document.getElementById("kitaplarGrid");
        const hobiGrid = document.getElementById("hobi");
        const kirtasiyeGrid = document.getElementById("kirtasiye");
        const pagination = document.getElementById("pagination");

        const marka = this.dataset.marka.toLowerCase();

        // Seçilen markaları listeye ekle / çıkar
        if (this.checked) {
            seciliMarkalar.push(marka);
        } else {
            seciliMarkalar = seciliMarkalar.filter(m => m !== marka);
        }

        let bazAlinacakListe = [];

        // Filtreleme yapılacak aktif veri kaynağını belirleme
        if (window.sonAramaUrunleri && window.sonAramaUrunleri.length > 0) {
            bazAlinacakListe = window.sonAramaUrunleri;
        }
        else if (elektronikGrid) {
            bazAlinacakListe = elektronikler;
        } else if (kitaplarGrid) {
            bazAlinacakListe = kitaplar;
        } else if (hobiGrid) {
            bazAlinacakListe = hobi;
        } else if (kirtasiyeGrid) {
            bazAlinacakListe = kirtasiye;
        } else {
            bazAlinacakListe = tumUrunler;
        }

        // Tüm filtreler kaldırıldıysa varsayılan görünüme geri dön
        if (seciliMarkalar.length === 0) {
            markaFiltresiAktif = false;

            if (window.sonAramaUrunleri && window.sonAramaUrunleri.length > 0) {
                aramaGrid.innerHTML = "";
                window.sonAramaUrunleri.forEach(urun => ekranaKartBas(urun, aramaGrid));
            } else {
                aramaGrid.style.display = "none";
                aramaGrid.innerHTML = "";
                if (elektronikGrid) elektronikGrid.style.display = "grid";
                if (kitaplarGrid) kitaplarGrid.style.display = "grid";
                if (hobiGrid) hobiGrid.style.display = "grid";
                if (kirtasiyeGrid) kirtasiyeGrid.style.display = "grid";
                if (pagination) pagination.style.display = "flex";
            }
            return;
        }

        markaFiltresiAktif = true;

        // Seçili markalara göre filtreleme
        const filtrelenmisUrunler = bazAlinacakListe.filter(urun =>
            urun.marka && seciliMarkalar.includes(urun.marka.toLowerCase())
        );

        if (elektronikGrid) elektronikGrid.style.display = "none";
        if (kitaplarGrid) kitaplarGrid.style.display = "none";
        if (hobiGrid) hobiGrid.style.display = "none";
        if (kirtasiyeGrid) kirtasiyeGrid.style.display = "none";
        if (pagination) pagination.style.display = "none";

        aramaGrid.style.display = "grid";
        aramaGrid.innerHTML = "";

        if (filtrelenmisUrunler.length === 0) {
            aramaGrid.innerHTML = "<p style='grid-column: 1 / -1; font-weight: bold;'>Bu kategoride seçilen markalara ait ürün bulunamadı.</p>";
            return;
        }


        filtrelenmisUrunler.forEach(urun => ekranaKartBas(urun, aramaGrid));
    });
});

// Yazar Checkbox filtreleri dinleyicisi (kitaplar.html sayfası için)
document.querySelectorAll("input[data-yazar]").forEach(checkbox => {

    checkbox.addEventListener("change", function () {

        const kitaplarGrid = document.getElementById("kitaplarGrid");
        const aramaGrid = document.getElementById("aramaSonuclari");
        const pagination = document.getElementById("pagination");

        const yazar = this.dataset.yazar.toLowerCase();

        if (this.checked) {
            seciliMarkalar.push(yazar);
        } else {
            seciliMarkalar = seciliMarkalar.filter(m => m !== yazar);
        }

        if (seciliMarkalar.length === 0) {

            markaFiltresiAktif = false;

            aramaGrid.style.display = "none";
            aramaGrid.innerHTML = "";

            kitaplarGrid.style.display = "grid";

            if (pagination) {
                pagination.style.display = "flex";
            }

            return;
        }


        markaFiltresiAktif = true;

        const filtrelenmisKitaplar = kitaplar.filter(urun =>
            urun.yazar &&
            seciliMarkalar.includes(urun.yazar.toLowerCase())
        );

        kitaplarGrid.style.display = "none";

        if (pagination) {
            pagination.style.display = "none";
        }

        aramaGrid.style.display = "grid";
        aramaGrid.innerHTML = "";

        if (filtrelenmisKitaplar.length === 0) {

            aramaGrid.innerHTML = `
                <p style="grid-column: 1 / -1; font-weight: bold;">
                    Seçilen yazarlara ait kitap bulunamadı.
                </p>
            `;

            return;
        }


        filtrelenmisKitaplar.forEach(urun => {
            ekranaKartBas(urun, aramaGrid);
        });

    });

});

/**
 * Genel kart oluşturma ve DOM'a ekleme yardımcı fonksiyonu.
 */
function ekranaKartBas(urun, container) {
    const kart = document.createElement("div");
    kart.className = "product-card";

    kart.addEventListener("click", function () {

        console.log("KARTA TIKLANDI");
        console.log("Fotolink:", urun.fotolink);

        const fotolink = encodeURIComponent(urun.fotolink);

        window.location.href = `urun-detay.html?fotolink=${fotolink}`;
    });

    const fiyatHTML = urun.indirimlifiyat != null
        ? `<span class="indirimli-fiyat">${urun.indirimlifiyat} TL</span>
           <span class="normal-fiyat">${urun.fiyati} TL</span>`
        : `<span class="indirimli-fiyat">${urun.fiyati} TL</span>`;

    kart.innerHTML = `
        <div class="product-image">
            <img src="${urun.fotolink}" alt="${urun.urun_adi}">
        </div>
        <div class="product-info">
            <div class="product-name">${urun.urun_adi}</div>
            <div class="product-publisher">${urun.marka ?? ""}</div>
            
            <div class="product-price">${fiyatHTML} </div>
           <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 
        </div>
        <div class="product-rating">
            ⭐ ${urun.yildiz_sayisi}
        </div>
        <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>
    `;
    container.appendChild(kart);
}

// =========================================================================
// 6. GLOBAL ARAMA ÇUBUĞU (SEARCH BOX) FORMU
// =========================================================================

const searchForm = document.querySelector(".search-container");

if (searchForm) {
    searchForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const input = searchForm.querySelector(".search-input");
        const kelime = input.value.trim();

        if (!kelime) {
            return;
        }

        const aramaGrid = document.getElementById("aramaSonuclari");
        const elektronikGrid = document.getElementById("elektronikGrid");
        const kitaplarGrid = document.getElementById("kitaplarGrid");
        const hobiGrid = document.getElementById("hobi");
        const kirtasiyeGrid = document.getElementById("kirtasiye");
        const pagination = document.getElementById("pagination");

        try {

            const response = await fetch(
                `http://localhost:5192/api/genel?kelime=${encodeURIComponent(kelime)}`
            );

            if (!response.ok) {
                throw new Error("API isteği başarısız oldu.");
            }

            const urunler = await response.json();

            console.log("Arama sonuçları:", urunler);

            // Arama sonuçlarını hafızaya al
            window.sonAramaUrunleri = urunler;

            // Normal ürün listelerini gizle
            if (elektronikGrid) elektronikGrid.style.display = "none";
            if (kitaplarGrid) kitaplarGrid.style.display = "none";
            if (hobiGrid) hobiGrid.style.display = "none";
            if (kirtasiyeGrid) kirtasiyeGrid.style.display = "none";

            // Sayfalamayı gizle
            if (pagination) pagination.style.display = "none";

            // Arama sonuçlarını göster
            if (aramaGrid) {
                aramaGrid.style.display = "grid";
                aramaGrid.innerHTML = "";

                if (urunler.length === 0) {
                    aramaGrid.innerHTML = `
                        <p style="grid-column: 1 / -1;">
                            "${kelime}" için ürün bulunamadı.
                        </p>
                    `;
                    return;
                }

                // Ürünleri ekrana bas
                urunler.forEach(urun => {
                    ekranaKartBas(urun, aramaGrid);
                });
            }

        } catch (error) {
            console.error("Arama hatası:", error);

            if (aramaGrid) {
                aramaGrid.style.display = "grid";
                aramaGrid.innerHTML = `
                    <p style="grid-column: 1 / -1;">
                        Arama sırasında bir hata oluştu.
                    </p>
                `;
            }
        }
    });
}

// =========================================================================
// 7. ANA SAYFA ÖNERİLEN ÜRÜNLER (RASTGELE ELEKTRONİK CAROUSEL)
// =========================================================================

function rastgeleElektronikSliderOlustur() {

    const grid = document.getElementById("randomElektronikGrid");

    if (!grid) {
        return;
    }

    // elektronikler dizisi henüz dolmadıysa çık
    if (typeof elektronikler === "undefined" || elektronikler.length === 0) {
        return;
    }

    grid.innerHTML = "";

    // Elektronik ürünlerden rastgele 10 tane seç
    const urunler = [...elektronikler]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);


    urunler.forEach(urun => {

        const kart = document.createElement("div");

        kart.className = "product-card";


        // SENİN MEVCUT KART YAPIN
        const fiyatHTML = urun.indirimlifiyat != null

            ? `
                <span class="indirimli-fiyat">
                    ${urun.indirimlifiyat} TL
                </span>

                <span class="normal-fiyat">
                    ${urun.fiyati} TL
                </span>
            `

            : `
                <span class="indirimli-fiyat">
                    ${urun.fiyati} TL
                </span>
            `;


        kart.innerHTML = `

            <div class="product-image">

                <img
                    src="${urun.fotolink}"
                    alt="${urun.urun_adi}"
                >

            </div>


            <div class="product-info">

                <div class="product-name">
                    ${urun.urun_adi}
                </div>

                <div class="product-publisher">
                    ${urun.marka ?? ""}
                </div>

                <div class="product-price">
                    ${fiyatHTML}
                </div>

                 <div class="icon1" onclick = "sepeteEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;" >
        <span>🧺</span>
</div> 

            </div>


            <div class="product-rating">
                ⭐ ${urun.yildiz_sayisi ?? 0}
            </div>


           <div class="product-fav" onclick = "favEkle('${urun.fotolink}', '${urun.urun_adi}', '${urun.fiyati}', '${urun.indirimlifiyat}', this, event)" style = "cursor: pointer;">
        <span>♡</span></div>

        `;


        // Mevcut detay fonksiyonunu kullan
        kart.addEventListener("click", function () {
            urunDetayinaGit(urun);
        });


        grid.appendChild(kart);

    });
}

// Rastgele önerilen ürünler slider'ı ileri/geri kaydırma dinleyicileri
document.getElementById("randomIleri")?.addEventListener("click", function () {

    document.getElementById("randomElektronikGrid").scrollBy({
        left: 500,
        behavior: "smooth"
    });

});


document.getElementById("randomGeri")?.addEventListener("click", function () {

    document.getElementById("randomElektronikGrid").scrollBy({
        left: -500,
        behavior: "smooth"
    });

});

// =========================================================================
// 8. KİMLİK DOĞRULAMA (ÜYE OL / GİRİŞ YAP MOD YÖNETİMİ VE API ENTEGRASYONU)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    let isLoginMode = false;

    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const toggleBtn = document.getElementById('toggle-btn');
    const toggleText = document.getElementById('toggle-text');
    const registerFields = document.querySelectorAll('.register-field');

    // Giriş Yap <-> Üye Ol modları arası toggle geçişi
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;

            if (isLoginMode) {
                formTitle.textContent = 'Giriş Yap';
                submitBtn.textContent = 'Giriş Yap';
                toggleText.textContent = 'Hesabınız yok mu?';
                toggleBtn.textContent = 'Üye Olun';

                registerFields.forEach(input => {
                    input.classList.add('d-none');
                    input.removeAttribute('required');
                });
            } else {
                formTitle.textContent = 'Üye Ol';
                submitBtn.textContent = 'Üye Ol';
                toggleText.textContent = 'Zaten hesabınız var mı?';
                toggleBtn.textContent = 'Giriş Yapın';

                registerFields.forEach(input => {
                    input.classList.remove('d-none');
                    input.setAttribute('required', 'true');
                });
            }
        });
    }

    // Form Gönderim Dinleyicisi
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Sayfa yenilenmesini engeller

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!email || !password) {
                alert('Lütfen e-posta ve şifre alanlarını doldurun!');
                return;
            }

            if (isLoginMode) {
                // GİRİŞ YAPMA KISMI BAĞLANDI:
                await girisYap(email, password);
            } else {
                const name = document.getElementById('name').value.trim();
                const surname = document.getElementById('surname').value.trim();
                const confirmInput = document.getElementById('confirm-password');

                // Eğer confirm-password HTML'de açıksa kontrol et
                if (confirmInput && password !== confirmInput.value.trim()) {
                    alert('Şifreler birbiriyle uyuşmuyor!');
                    return;
                }

                if (!name || !surname) {
                    alert('Lütfen ad ve soyad alanlarını doldurun!');
                    return;
                }

                await kayitOl({
                    uye_ad: name,
                    uye_soyad: surname,
                    uye_eposta: email,
                    uye_sifre: password
                });
            }
        });
    }
});

/**
 * Yeni üye kaydı için /api/uyebilgi/kayit endpoint'ine POST isteği gönderir.
 */
async function kayitOl(gonderilecekVeri) {
    try {
        const response = await fetch('http://localhost:5192/api/uyebilgi/kayit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gonderilecekVeri)
        });



        if (response.ok) {
            alert('Kayıt başarıyla tamamlandı! Telefon kaydı için lütfen hesabım bölümünü kontrol ediniz!!!');
            console.log('Sunucu Yanıtı:', await response.json());
        } else {
            console.error('Sunucu Hatası:', response.status);
            alert('Kayıt oluşturulamadı, durum kodu: ' + response.status);
        }
    } catch (error) {
        console.error('İstek Hatası (CORS / Bağlantı / SSL):', error);
        alert('Sunucuya bağlanılamadı! Konsolu (F12) kontrol edin.');
    }
}

/**
 * Üye girişi için API'den kullanıcı listesini çeker, eşleşme varsa aktif kullanıcıyı localStorage'a yazar.
 */
async function girisYap(email, password) {
    try {
        const response = await fetch("http://localhost:5192/api/uyebilgi/girisyap");
        const uyeler = await response.json();

        const bulunanUye = uyeler.find(uye => uye.uye_eposta === email && uye.uye_sifre === password);


        if (bulunanUye) {
            localStorage.setItem("aktifKullanici", JSON.stringify(bulunanUye));
            console.log("Giriş başarılı");
            alert("Hoş geldiniz, " + bulunanUye.uye_ad + " " + bulunanUye.uye_soyad);
            window.location.href = "index.html";
        } else {
            console.log("Giriş başarısız: E-posta veya şifre hatalı");
            alert("E-posta veya şifre hatalı!");

        }

    }
    catch {
        console.log("Burası çalıştı 2")
    }
}

// =========================================================================
// 9. KULLANICI OTURUMU VE HEADER SENKRONİZASYONU
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    kullaniciDurumunuKontrolEt();
});

/**
 * Header'daki giriş yap butonunu veya oturum açılmışsa profil dropdown'ını gösterir.
 */
function kullaniciDurumunuKontrolEt() {
    const aktifKullanici = JSON.parse(localStorage.getItem("aktifKullanici"));

    const navLoginBtn = document.getElementById("nav-login-btn");
    const userMenu = document.getElementById("user-menu");
    const userFullname = document.getElementById("user-fullname");
    const userAvatarBadge = document.getElementById("user-avatar-badge");
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenu || !navLoginBtn) return;

    if (aktifKullanici) {
        navLoginBtn.classList.add("d-none");
        userMenu.classList.remove("d-none");

        const ad = aktifKullanici.uye_ad || "";
        const soyad = aktifKullanici.uye_soyad || "";

        userFullname.textContent = `${ad} ${soyad.toUpperCase()}`;

        const basHarfler = `${ad.charAt(0)}${soyad.charAt(0)}`.toUpperCase();
        userAvatarBadge.textContent = basHarfler || "U";

        if (logoutBtn) {
            logoutBtn.onclick = () => {
                localStorage.removeItem("aktifKullanici");
                window.location.reload();
            };
        }
    } else {
        navLoginBtn.classList.remove("d-none");
        userMenu.classList.add("d-none");
    }
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            if (e) e.preventDefault();
            // Sepeti silme, sadece oturumu kapat
            localStorage.removeItem("aktifKullanici");
            window.location.href = "index.html";
        };
    }
}

// =========================================================================
// 10. YARDIMCI FORMAT VE BİLDİRİM FONKSİYONLARI
// =========================================================================

/**
 * Fiyat metinlerini ondalık float sayıya çevirir.
 */
function fiyatiSayiyaCevir(deger) {
    if (!deger) return 0;
    if (typeof deger === 'number') return deger;

    let str = deger.toString().trim();

    // 1. Sadece rakam, nokta ve virgülü bırak
    str = str.replace(/[^\d.,]/g, '');

    // 2. Virgülü noktaya çevir
    str = str.replace(/,/g, '.');

    // 3. Eğer metinde nokta varsa (Örn: "1.799.00" veya "1.799" veya "1799.00")
    if (str.includes('.')) {
        const parcalar = str.split('.');
        const sonParca = parcalar[parcalar.length - 1];

        // Eğer noktadan sonraki kısım 2 haneli kuruşsa (örn: "00" veya "50")
        if (sonParca.length === 2) {
            const tamKisim = parcalar.slice(0, -1).join('');
            str = `${tamKisim}.${sonParca}`;
        } else {
            // Noktadan sonraki kısım kuruş değilse (örn: 3 haneli binlik "799"), tüm noktaları sil
            str = parcalar.join('');
        }
    }

    let sayi = parseFloat(str);
    return isNaN(sayi) ? 0 : sayi;
}

/**
 * Ekranın sağ altına geçici başarı bildirim kutusu (Toast) basar.
 */
function bildirimGoster(mesaj) {
    let toast = document.getElementById("sepet-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "sepet-toast";
        toast.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 25px;
            background: #1e293b;
            color: #ffffff;
            padding: 14px 22px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            z-index: 99999;
            font-family: inherit;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="color:#10b981; font-weight:bold; font-size:16px;">✓</span> <span>${mesaj}</span>`;
    toast.style.display = "flex";
    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 2500);
}

// =========================================================================
// 11. SEPET YÖNETİMİ (LOCALSTORAGE, EKLEME, LİSTELEME, SİLME)
// =========================================================================

/**
 * Aktif kullanıcıya özel sepet localStorage anahtarını (sepet_GUID) döner.
 */
function getSepetKey() {
    const kayitli = localStorage.getItem("aktifKullanici");
    if (!kayitli) return null;
    const user = JSON.parse(kayitli);
    return `sepet_${user.uye_id}`;
}
// ==========================================

/**
 * Ürünü aktif kullanıcının sepetine ekler veya adedini 1 artırır.
 */
function sepeteEkle(fotolink, urunAdi, fiyati, indirimlifiyat, element, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const sepetKey = getSepetKey();
    if (!sepetKey) {
        alert("Sepete ürün ekleyebilmek için lütfen önce giriş yapın!");
        window.location.href = "uye.html";
        return;
    }

    const urunVerisi = {
        fotolink: fotolink || "",
        urun_adi: urunAdi || "Ürün",
        fiyati: fiyati || "0",
        indirimlifiyat: indirimlifiyat || "0",
        adet: 1
    };

    let sepet = JSON.parse(localStorage.getItem(sepetKey)) || [];

    const index = sepet.findIndex(item => item.fotolink === urunVerisi.fotolink);
    if (index > -1) {
        sepet[index].adet += 1;
    } else {
        sepet.push(urunVerisi);
    }

    localStorage.setItem(sepetKey, JSON.stringify(sepet));
    bildirimGoster(`${urunVerisi.urun_adi} sepete eklendi!`);



}

/**
 * sepet.html sayfasında sepet listesini ve sipariş özet tablosunu oluşturur.
 */
function sepetiYukle() {
    const cartList = document.getElementById("cart-list");
    if (!cartList) return;

    const sepetKey = typeof getSepetKey === "function" ? getSepetKey() : null;
    if (!sepetKey) {
        cartList.innerHTML = '<p style="text-align:center; padding:30px; color:#666;">Sepetinizi görmek için lütfen giriş yapın.</p>';
        if (document.getElementById("summary-subtotal")) document.getElementById("summary-subtotal").textContent = "0.00 TL";
        if (document.getElementById("summary-total-price")) document.getElementById("summary-total-price").textContent = "0.00 TL";
        if (typeof kargoDurumunuGuncelle === "function") kargoDurumunuGuncelle(0);
        return;
    }

    const sepet = JSON.parse(localStorage.getItem(sepetKey)) || [];

    if (sepet.length === 0) {
        cartList.innerHTML = '<div class="empty-cart-msg" style="text-align:center; padding:40px; color:#666;"><p>Sepetinizde ürün bulunmuyor.</p></div>';
        if (document.getElementById("summary-subtotal")) document.getElementById("summary-subtotal").textContent = "0.00 TL";
        if (document.getElementById("summary-total-price")) document.getElementById("summary-total-price").textContent = "0.00 TL";
        if (typeof kargoDurumunuGuncelle === "function") kargoDurumunuGuncelle(0);
        return;
    }

    let araToplam = 0;
    cartList.innerHTML = "";

    sepet.forEach((item, index) => {
        const normalFiyat = fiyatiSayiyaCevir(item.fiyati);
        const indirimliFiyat = fiyatiSayiyaCevir(item.indirimlifiyat);
        const birimFiyat = indirimliFiyat > 0 ? indirimliFiyat : normalFiyat;
        const urunAdeti = item.adet || 1;
        const toplamUrunTutari = birimFiyat * urunAdeti;
        araToplam += toplamUrunTutari;

        cartList.innerHTML += `
            <div class="cart-item" style="display:flex; align-items:center; justify-content:space-between; padding:15px 0; border-bottom:1px solid #eee;">
                <img src="${item.fotolink}" alt="${item.urun_adi}" style="width:75px; height:75px; object-fit:cover; border-radius:8px;">
                <div class="cart-item-details" style="flex:1; margin-left:20px;">
                    <div class="cart-item-title" style="font-weight:600; font-size:16px;">${item.urun_adi}</div>
                    <div style="margin-top:8px; display:flex; align-items:center; gap:15px;">
                        <div>
                            ${indirimliFiyat > 0 ? `<span style="text-decoration:line-through; color:#888; font-size:13px; margin-right:6px;">${normalFiyat.toFixed(5)} TL</span>` : ''}
                            <span style="color:#005f73; font-weight:bold; font-size:15px;">${birimFiyat.toFixed(5)} TL</span>
                        </div>
                        <div style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; overflow:hidden;">
                            <button type="button" onclick="adetDegistir(${index}, -1)" style="border:none; background:transparent; padding:4px 10px; cursor:pointer; font-weight:bold; font-size:14px;">-</button>
                            <span style="padding:0 8px; font-weight:600; font-size:14px;">${urunAdeti}</span>
                            <button type="button" onclick="adetDegistir(${index}, 1)" style="border:none; background:transparent; padding:4px 10px; cursor:pointer; font-weight:bold; font-size:14px;">+</button>
                        </div>
                        <span style="font-size:14px; color:#333;">Toplam: <strong>${toplamUrunTutari.toFixed(5)} TL</strong></span>
                    </div>
                </div>
                <button class="cart-remove-btn" onclick="sepettenSil(${index})" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Kaldır</button>
            </div>
        `;
    });

    // 1. Kargo Ücretini ve İlerleme Çubuğunu Güncelle
    // 1. Kargo Ücretini Hesapla
    const kargoUcreti = typeof kargoDurumunuGuncelle === "function" ? kargoDurumunuGuncelle(araToplam) : 79.90;

    // 2. Genel Toplam
    const genelToplam = araToplam + kargoUcreti;

    // 3. Ekrana Yazdır
    if (document.getElementById("summary-subtotal")) {
        document.getElementById("summary-subtotal").textContent = `${araToplam.toFixed(2)} TL`;
    }

    // Kargo yazısını ID ile doğrudan yakala
    const kargoEl = document.getElementById("summary-shipping");
    if (kargoEl) {
        if (kargoUcreti === 0) {
            kargoEl.textContent = "Ücretsiz";
            kargoEl.style.color = "#22c55e";
        } else {
            kargoEl.textContent = `${kargoUcreti.toFixed(2)} TL`;
            kargoEl.style.color = "#0f172a";
        }
    }

    if (document.getElementById("summary-total-price")) {
        document.getElementById("summary-total-price").textContent = `${genelToplam.toFixed(2)} TL`;
    }
}

/**
 * Ürünü sepetten tamamen siler ve görünümü yeniler.
 */
function sepettenSil(index) {
    const sepetKey = getSepetKey();
    if (!sepetKey) return;

    let sepet = JSON.parse(localStorage.getItem(sepetKey)) || [];
    sepet.splice(index, 1);
    localStorage.setItem(sepetKey, JSON.stringify(sepet));
    sepetiYukle();
}


//-----------------------------------------------------------

// =========================================================================
// 12. FAVORİLER YÖNETİMİ (LOCALSTORAGE, EKLEME, LİSTELEME, SİLME)
// =========================================================================

/**
 * Favori ekleme bildirimi için Toast kutusu basar.
 */
function bildirimGoster(mesaj) {
    let toast = document.getElementById("fav-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "fav-toast";
        toast.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 25px;
            background: #1e293b;
            color: #ffffff;
            padding: 14px 22px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            z-index: 99999;
            font-family: inherit;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="color:#10b981; font-weight:bold; font-size:16px;">✓</span> <span>${mesaj}</span>`;
    toast.style.display = "flex";
    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 2500);
}

/**
 * Aktif kullanıcının favori depolama anahtarını (fav_GUID) döner.
 */
function getFavKey() {
    const kayitli = localStorage.getItem("aktifKullanici");
    if (!kayitli) return null;
    const user = JSON.parse(kayitli);
    return `fav_${user.uye_id}`;
}

/**
 * Ürünü aktif kullanıcının favoriler listesine kaydeder.
 */
function favEkle(fotolink, urunAdi, fiyati, indirimlifiyat, element, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const favKey = getFavKey();
    if (!favKey) {
        alert("Favorilere ürün ekleyebilmek için lütfen önce giriş yapın!");
        window.location.href = "uye.html";
        return;
    }

    const urunVerisi = {
        fotolink: fotolink || "",
        urun_adi: urunAdi || "Ürün",
        fiyati: fiyati || "0",
        indirimlifiyat: indirimlifiyat || "0",
        adet: 1
    };

    let fav = JSON.parse(localStorage.getItem(favKey)) || [];

    const index = fav.findIndex(item => item.fotolink === urunVerisi.fotolink);
    if (index > -1) {
        fav[index].adet += 1;
    } else {
        fav.push(urunVerisi);
    }

    localStorage.setItem(favKey, JSON.stringify(fav));
    bildirimGoster(`${urunVerisi.urun_adi} favorilere eklendi!`);



}

/**
 * favoriler.html sayfasında kayıtlı favori ürünleri render eder.
 */
function faviYukle() {
    const favList = document.getElementById("fav-list");
    if (!favList) return;

    const favKey = getFavKey();
    if (!favKey) {
        favList.innerHTML = '<p style="text-align:center; padding:30px; color:#666;">Favorilerinizi görmek için lütfen giriş yapın.</p>';
        // if (document.getElementById("summary-subtotal")) document.getElementById("summary-subtotal").textContent = "0.00 TL";
        // if (document.getElementById("summary-total-price")) document.getElementById("summary-total-price").textContent = "0.00 TL";
        return;
    }

    const fav = JSON.parse(localStorage.getItem(favKey)) || [];

    if (fav.length === 0) {
        favList.innerHTML = '<div class="empty-fav-msg" style="text-align:center; padding:40px; color:#666;"><p>Favorilerinizde ürün bulunmuyor.</p></div>';
        // if (document.getElementById("summary-subtotal")) document.getElementById("summary-subtotal").textContent = "0.00 TL";
        // if (document.getElementById("summary-total-price")) document.getElementById("summary-total-price").textContent = "0.00 TL";
        return;
    }

    let genelToplam = 0;
    favList.innerHTML = "";

    fav.forEach((item, index) => {

        let fiyatHTML = '';
        if (parseFloat(item.indirimlifiyat) > 0) {
            fiyatHTML = `<span style="color:#005f73; font-weight:bold; font-size:15px;  margin-right:15px">${item.indirimlifiyat} TL</span><span style="text-decoration:line-through; color:#888; font-size:13px;">${item.fiyati} TL</span>`;
        } else {
            fiyatHTML = `<span style="color:#005f73; font-weight:bold; font-size:15px;">${item.fiyati} TL</span>`;
        }

        const birimFiyat = parseFloat(item.indirimlifiyat) > 0 ? parseFloat(item.indirimlifiyat) : parseFloat(item.fiyati);
        const normalFiyat = parseFloat(item.fiyati);
        const indirimliFiyat = parseFloat(item.indirimlifiyat);
        const urunAdeti = item.adet;



        favList.innerHTML += `
            <div class="cart-item" style="display:flex; align-items:center; justify-content:space-between; padding:15px 0; border-bottom:1px solid #eee;">
                <img src="${item.fotolink}" alt="${item.urun_adi}" style="width:100px; height:100px; object-fit:cover; border-radius:8px;">
                <div class="cart-item-details" style="flex:1; margin-left:20px;">
                    <div class="cart-item-title" style="font-weight:600; font-size:16px;">${item.urun_adi}</div>
                    <div style="margin-top:8px; display:flex; align-items:center; gap:15px;">
                        <div>
                            ${fiyatHTML}
                        </div>
                        
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                <button class="cart-remove-btn" onclick="sepeteEkle('${item.fotolink}', '${item.urun_adi}', '${item.fiyati}', '${item.indirimlifiyat}', this, event)" style="background: #005f73; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Sepete Ekle</button>
                <button class="cart-remove-btn" onclick="favoridenSil(${index})" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Kaldır</button>
                </div>
            </div>
        `;
    });

    if (document.getElementById("summary-subtotal")) document.getElementById("summary-subtotal").textContent = `${genelToplam.toFixed(2)} TL`;
    if (document.getElementById("summary-total-price")) document.getElementById("summary-total-price").textContent = `${genelToplam.toFixed(2)} TL`;
}

/**
 * Ürünü favoriler listesinden siler.
 */
function favoridenSil(index) {
    const favKey = getFavKey();
    if (!favKey) return;

    let fav = JSON.parse(localStorage.getItem(favKey)) || [];
    fav.splice(index, 1);
    localStorage.setItem(favKey, JSON.stringify(fav));
    faviYukle();
}

// =========================================================================
// 13. PROFİL VE SOL MENÜ BİLGİLERİNİ GÜNCELLEME
// =========================================================================

function profilMenusuGuncelle() {
    const kayitliKullanici = localStorage.getItem("aktifKullanici");
    const menuKutusu = document.getElementById("user-profile-menu");
    if (!menuKutusu) return;

    if (!kayitliKullanici) {
        menuKutusu.style.display = "none";
        return;
    }

    menuKutusu.style.display = "block";
    const user = JSON.parse(kayitliKullanici);

    const ad = user.uye_ad || "";
    const soyad = user.uye_soyad || "";

    // Ad Soyad & Baş Harfleri Ata
    const fullNameEl = document.getElementById("menu-fullname");
    const avatarBadgeEl = document.getElementById("menu-avatar-badge");

    if (fullNameEl) fullNameEl.textContent = `${ad} ${soyad.toUpperCase()}`;
    if (avatarBadgeEl) {
        avatarBadgeEl.textContent = `${ad.charAt(0)}${soyad.charAt(0)}`.toUpperCase() || "U";
    }

    // Kırmızı Çıkış Butonu Olayı
    const logoutBtn = document.getElementById("profile-logout-btn");
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem("aktifKullanici");
            window.location.href = "index.html";
        };
    }
}

// Sayfa yüklendiğinde çağır
document.addEventListener('DOMContentLoaded', () => {
    profilMenusuGuncelle();
});

// =========================================================================
// 14. SİPARİŞ KAYIT MODELİ VE API İSTEĞİ
// =========================================================================

const aktifKullanici = JSON.parse(localStorage.getItem("aktifKullanici") || "{}");
const gonderileceksiparisVeri = {
    uye_id: aktifKullanici.uye_id,
    // uye_ad: aktifKullanici.uye_ad,
    // uye_soyad: aktifKullanici.uye_soyad,
    toplam_ucret: document.getElementById("summary-total-price"),
    adres: selectedAddressKey,
    urunler: [
        {
            urun_adi: "",
            fotolink: "",
            indirimlifiyat: "",
            fiyat: "",
            marka: ""
        }
    ]
};

/**
 * Sipariş nesnesini /api/siparis endpoint'ine POST atarak SQL tablosuna kaydeder.
 */
async function sipariskaydi(gonderileceksiparisVeri) {
    console.log(gonderileceksiparisVeri);
    try {
        const response = await fetch('http://localhost:5192/api/siparis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gonderileceksiparisVeri)
        });

        if (response.ok) {
            alert('Kayıt başarıyla tamamlandı!  ');
            console.log('Sunucu Yanıtı:', await response.json());
        } else {
            console.error('Sunucu Hatası:', response.status);
            alert('Kayıt oluşturulamadı, durum kodu: ' + response.status);
        }
    } catch (error) {
        console.error('İstek Hatası (CORS / Bağlantı / SSL):', error);
        alert('Sunucuya bağlanılamadı! Konsolu (F12) kontrol edin.');
    }
}

