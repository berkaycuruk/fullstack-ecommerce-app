// =========================================================================
// 1. URL PARAMETRESİ AYRIŞTIRMA (QUERY STRING EXTRACTION)
// =========================================================================

// Sayfa linkindeki GET parametrelerini yakalar (Örn: urun-detay.html?fotolink=https%3A%2F%2F...)
const detailParams = new URLSearchParams(window.location.search);

// Ürünün benzersiz görsel adresini parametre olarak çeker
const fotolink = detailParams.get("fotolink");

console.log("URL'den gelen fotolink:", fotolink);

// =========================================================================
// 2. ÜRÜN DETAYINI API'DEN ÇEKME VE DOM'A YAZMA MOTORU
// =========================================================================

/**
 * Backend'deki /api/genel/detay endpoint'ine istek atarak ilgili ürünün
 * detaylı verilerini çeker ve HTML elemanlarına dinamik olarak basar.
 */
async function urunDetayGetir() {

    // Parametre gelmediyse işlemi durdur
    if (!fotolink) {
        console.error("Fotolink yok!");
        return;
    }

    try {

        // Backend API detay sorgu adresi
        const apiUrl =
            `http://localhost:5192/api/genel/detay?fotolink=${encodeURIComponent(fotolink)}`;

        console.log("API'ye gönderilen URL:", apiUrl);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error("Ürün bulunamadı.");
        }

        const urun = await response.json();

        console.log("API'den gelen ürün:", urun);

        // -------------------------------------------------------------
        // A. TEMEL GÖRSEL VE METİN ALANLARINI DOLDURMA
        // -------------------------------------------------------------

        // Ürün ana görselini yükle
        document.getElementById("urunFotograf").src = urun.fotolink;

        // Ürün adını başlığa yaz
        document.getElementById("urunAdi").textContent =
            urun.urun_adi;

        // Ürün tipi yazar veya marka içeriyorsa uygun olanını bas
        const bilgi = document.getElementById("urunBilgi");

        if (urun.yazar) {
            bilgi.textContent = urun.yazar;
        } else if (urun.marka) {
            bilgi.textContent = urun.marka;
        } else {
            bilgi.textContent = "";
        }

        // Yıldız puanını bas
        document.getElementById("urunYildiz").textContent =
            urun.yildiz_sayisi ?? "0";

        // -------------------------------------------------------------
        // B. FİYAT VE İNDİRİM GÖSTERİMİ
        // -------------------------------------------------------------

        const fiyat = document.getElementById("urunFiyat");

        // İndirimli fiyat mevcutsa hem indirimliyi hem üstü çizili eski fiyatı bas
        if (urun.indirimlifiyat != null) {

            fiyat.innerHTML = `
                <span class="indirimli-fiyat">
                    ${urun.indirimlifiyat} 
                </span>

                <span class="normal-fiyat">
                    ${urun.fiyati} TL
                </span>
            `;

        } else {

            fiyat.innerHTML = `
                <span class="indirimli-fiyat">
                    ${urun.fiyati} TL
                </span>
            `;
        }

        // -------------------------------------------------------------
        // C. DEĞERLENDİRME VE DETAYLI AÇIKLAMA METİNLERİ
        // -------------------------------------------------------------

        document.getElementById("urunDegerlendirme").textContent =
            urun.degerlendirme_sayisi ?? "0";

        document.getElementById("urunAciklama").textContent =
            urun.aciklama ?? "Açıklama bulunmuyor.";

        // -------------------------------------------------------------
        // D. AKSİYON BUTONLARINI BAĞLAMA (SEPET & FAVORİ ENTEGRASYONU)
        // -------------------------------------------------------------

        // Sepete Ekle Butonu: script.js içerisindeki sepeteEkle fonksiyonuna veriyi iletir
        const sepeteEkleBtn = document.getElementById("sepeteEkleBtn");
        if (sepeteEkleBtn) {
            sepeteEkleBtn.onclick = function (e) {
                if (typeof window.sepeteEkle === 'function') {
                    window.sepeteEkle(urun.fotolink, urun.urun_adi, urun.fiyati, urun.indirimlifiyat, this, e);
                } else {
                    console.error("sepeteEkle fonksiyonu bulunamadı.");
                }
            };
        }

        // Favorilere Ekle Butonu: script.js içerisindeki favEkle fonksiyonuna veriyi iletir
        const favEkleBtn = document.getElementById("favorilereEkleBtn");
        if (favEkleBtn) {
            favEkleBtn.onclick = function (e) {
                if (typeof window.favEkle === 'function') {
                    window.favEkle(urun.fotolink, urun.urun_adi, urun.fiyati, urun.indirimlifiyat, this, e);
                } else {
                    console.error("favEkle fonksiyonu bulunamadı.");
                }
            };
        }

    } catch (error) {

        console.error("Ürün detay hatası:", error);

    }
}

// Sayfa açıldığında detay getirme fonksiyonunu doğrudan tetikle
urunDetayGetir();