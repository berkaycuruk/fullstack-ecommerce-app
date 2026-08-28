using System.Data;
using System.Globalization;
using System.Collections.Concurrent;
using Microsoft.Data.SqlClient;
using Iyzipay;
using Iyzipay.Model;
using Iyzipay.Request;

// ============================================================
// UYGULAMA YAPILANDIRMASI VE BAŞLATMA
// ============================================================
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Frontend istemcisinin (Live Server portları) API'ye erişebilmesi için CORS yapılandırması
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors("Frontend");

// MSSQL Veritabanı bağlantı dizesi
string connectionString = "Server=localhost;Database=selenium2;Integrated Security=True;TrustServerCertificate=True;";

// iyzico ödeme formu ile callback arasında token bazlı sipariş verisini RAM'de güvenle eşleştiren thread-safe havuz
// Ödeme eşleme hafıza havuzu
var pendingOrders = new ConcurrentDictionary<string, sipariskayitmodel>();

// ============================================================
// SİPARİŞ ENDPOINTLERİ
// ============================================================

// Siparişi doğrudan veritabanındaki 'siparis' tablosuna INSERT eden endpoint
app.MapPost("/api/sipariskaydi", async (sipariskayitmodel model) =>
{
    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();

        string query = @"INSERT INTO siparis (uye_id, toplam_ucret, adres, urunler)
                         VALUES (@uye_id, @toplam_ucret, @adres, @urunler)";

        using SqlCommand cmd = new(query, connection);
        cmd.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = model.uye_id;
        cmd.Parameters.Add("@toplam_ucret", SqlDbType.Decimal).Value = model.toplam_ucret;
        cmd.Parameters.Add("@adres", SqlDbType.NVarChar, -1).Value = model.adres;
        cmd.Parameters.Add("@urunler", SqlDbType.NVarChar, -1).Value = model.urunler;

        await cmd.ExecuteNonQueryAsync();
        return Results.Ok(new { message = "Sipariş başarılı" });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// Belirtilen kullanıcıya ait geçmiş siparişleri en yeniden eskiye doğru listeleyen GET endpoint
app.MapGet("/api/siparislerim", async (string? uyeId) =>
{
    if (string.IsNullOrWhiteSpace(uyeId) || !Guid.TryParse(uyeId, out Guid guidUyeId))
        return Results.BadRequest(new { mesaj = "Geçersiz veya eksik uyeId." });

    List<object> siparisler = new();
    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();

        string query = @"SELECT * FROM siparis WHERE uye_id = @uyeId ORDER BY siparis_tarihi DESC";
        using SqlCommand command = new(query, connection);
        command.Parameters.Add("@uyeId", SqlDbType.UniqueIdentifier).Value = guidUyeId;

        using SqlDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            siparisler.Add(new
            {
                siparis_id = reader["siparis_id"],
                uye_id = reader["uye_id"],
                urunler = reader["urunler"],
                adres = reader["adres"],
                toplam_ucret = reader["toplam_ucret"],
                siparis_tarihi = reader["siparis_tarihi"]
            });
        }
        return Results.Ok(siparisler);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// Sipariş ID'sine göre siparişi veritabanından silen DELETE endpoint
app.MapDelete("/api/siparislerim/sil", async (string? siparis_id) =>
{
    if (string.IsNullOrWhiteSpace(siparis_id))
        return Results.BadRequest(new { mesaj = "siparis_id parametresi boş olamaz." });

    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();

        string query = "DELETE FROM siparis WHERE siparis_id = @siparis_id";
        using SqlCommand command = new(query, connection);

        if (Guid.TryParse(siparis_id, out Guid guidId))
            command.Parameters.Add("@siparis_id", SqlDbType.UniqueIdentifier).Value = guidId;
        else
            command.Parameters.Add("@siparis_id", SqlDbType.NVarChar, 100).Value = siparis_id;

        int etkilenen = await command.ExecuteNonQueryAsync();
        return etkilenen > 0 ? Results.Ok(new { mesaj = "Sipariş silindi." }) : Results.NotFound(new { mesaj = "Sipariş bulunamadı." });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// ============================================================
// ÜYELİK VE GENEL ENDPOINTLER
// ============================================================

// Yeni kullanıcı kaydını 'uye' tablosuna ekleyen POST endpoint
app.MapPost("/api/uyebilgi/kayit", async (UyeKayitModel model) =>
{
    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string query = @"INSERT INTO uye (uye_ad, uye_soyad, uye_eposta, uye_sifre, telefon) 
                         VALUES (@uye_ad, @uye_soyad, @uye_eposta, @uye_sifre, @telefon)";
        using SqlCommand cmd = new(query, connection);
        cmd.Parameters.Add("@uye_ad", SqlDbType.VarChar, 50).Value = model.uye_ad;
        cmd.Parameters.Add("@uye_soyad", SqlDbType.VarChar, 50).Value = model.uye_soyad;
        cmd.Parameters.Add("@uye_eposta", SqlDbType.VarChar, 100).Value = model.uye_eposta;
        cmd.Parameters.Add("@uye_sifre", SqlDbType.VarChar, 255).Value = model.uye_sifre;
        cmd.Parameters.Add("@telefon", SqlDbType.NVarChar, 20).Value = string.IsNullOrWhiteSpace(model.telefon) ? DBNull.Value : model.telefon.Trim();
        await cmd.ExecuteNonQueryAsync();
        return Results.Ok(new { message = "Kayıt başarılı" });
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// Aktif kullanıcıları döndüren GET endpoint
app.MapGet("/api/uyebilgi/girisyap", async () =>
{
    try
    {
        List<object> uye = new();
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string query = "SELECT * FROM uye WHERE aktivite = 'AKTİF'";
        using SqlCommand command = new(query, connection);
        using SqlDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            uye.Add(new
            {
                uye_id = reader["uye_id"],
                uye_ad = reader["uye_ad"],
                uye_soyad = reader["uye_soyad"],
                uye_eposta = reader["uye_eposta"],
                uye_sifre = reader["uye_sifre"],
                aktivite = reader["aktivite"]
            });
        }
        return Results.Ok(uye);
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// 'sp_TumUrunleriGetir' Stored Procedure'ünü çalıştırarak genel ürün aramasını yürüten GET endpoint
app.MapGet("/api/genel", async (string? kelime) =>
{
    List<object> urunler = new();
    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string query = "EXEC sp_TumUrunleriGetir @kelime";
        using SqlCommand command = new(query, connection);
        command.Parameters.Add("@kelime", SqlDbType.NVarChar, 500).Value = (object?)kelime ?? DBNull.Value;
        using SqlDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            urunler.Add(new
            {
                urun_adi = reader["urun_adi"],
                kategori = reader["kategori"],
                yazar = reader["yazar"],
                fiyati = reader["fiyati"],
                marka = reader["marka"],
                degerlendirme_sayisi = reader["degerlendirme_sayisi"],
                fotolink = reader["fotolink"],
                aciklama = reader["aciklama"],
                yildiz_sayisi = reader["yildiz_sayisi"],
                indirimlifiyat = reader.IsDBNull(reader.GetOrdinal("indirimlifiyat")) ? null : reader["indirimlifiyat"]
            });
        }
        return Results.Ok(urunler);
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// 'IndirimliUrunleriGetir' Stored Procedure'ünü tetikleyerek sadece indirimli ürünleri getiren GET endpoint
app.MapGet("/api/genel/indirimli", async () =>
{
    List<object> urunler = new();
    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        using SqlCommand command = new("IndirimliUrunleriGetir", connection) { CommandType = CommandType.StoredProcedure };
        using SqlDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            urunler.Add(new
            {
                kategori = reader["kategori"] == DBNull.Value ? null : reader["kategori"].ToString(),
                urun_adi = reader["urun_adi"] == DBNull.Value ? null : reader["urun_adi"].ToString(),
                yazar = reader["yazar"] == DBNull.Value ? null : reader["yazar"].ToString(),
                fiyati = reader["fiyati"] == DBNull.Value ? null : reader["fiyati"],
                marka = reader["marka"] == DBNull.Value ? null : reader["marka"].ToString(),
                degerlendirme_sayisi = reader["degerlendirme_sayisi"] == DBNull.Value ? null : reader["degerlendirme_sayisi"],
                fotolink = reader["fotolink"] == DBNull.Value ? null : reader["fotolink"].ToString(),
                aciklama = reader["aciklama"] == DBNull.Value ? null : reader["aciklama"].ToString(),
                yildiz_sayisi = reader["yildiz_sayisi"] == DBNull.Value ? null : reader["yildiz_sayisi"],
                indirimlifiyat = reader["indirimlifiyat"] == DBNull.Value ? null : reader["indirimlifiyat"]
            });
        }
        return Results.Ok(urunler);
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// Görsel adresine (fotolink) göre tüm kategori tablolarını UNION ALL ile tarayan tekil ürün detay endpoint'i
app.MapGet("/api/genel/detay", async (string fotolink) =>
{
    if (string.IsNullOrWhiteSpace(fotolink))
        return Results.BadRequest(new { mesaj = "fotolink boş olamaz." });

    try
    {
        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string query = @"
            SELECT 'elektronik' AS kategori, urun_adi, fiyati, marka, degerlendirme_sayisi, fotolink, aciklama, yildiz_sayisi, indirimlifiyat, NULL AS yazar FROM elektronik WHERE fotolink = @fotolink
            UNION ALL
            SELECT 'hobi' AS kategori, urun_adi, fiyati, marka, degerlendirme_sayisi, fotolink, aciklama, yildiz_sayisi, indirimlifiyat, NULL AS yazar FROM hobi WHERE fotolink = @fotolink
            UNION ALL
            SELECT 'kirtasiye' AS kategori, urun_adi, fiyati, marka, degerlendirme_sayisi, fotolink, aciklama, yildiz_sayisi, indirimlifiyat, NULL AS yazar FROM kirtasiye WHERE fotolink = @fotolink
            UNION ALL
            SELECT 'kitaplar' AS kategori, urun_adi, fiyati, marka, degerlendirme_sayisi, fotolink, aciklama, yildiz_sayisi, indirimlifiyat, yazar FROM kitaplar WHERE fotolink = @fotolink;";

        using SqlCommand command = new(query, connection);
        command.Parameters.Add("@fotolink", SqlDbType.NVarChar, 500).Value = fotolink;

        using SqlDataReader reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return Results.NotFound("Bu fotolink'e sahip ürün bulunamadı.");

        var urun = new
        {
            kategori = reader["kategori"] == DBNull.Value ? null : reader["kategori"].ToString(),
            urun_adi = reader["urun_adi"] == DBNull.Value ? null : reader["urun_adi"].ToString(),
            fiyati = reader["fiyati"] == DBNull.Value ? null : reader["fiyati"],
            marka = reader["marka"] == DBNull.Value ? null : reader["marka"].ToString(),
            degerlendirme_sayisi = reader["degerlendirme_sayisi"] == DBNull.Value ? null : reader["degerlendirme_sayisi"],
            fotolink = reader["fotolink"] == DBNull.Value ? null : reader["fotolink"].ToString(),
            aciklama = reader["aciklama"] == DBNull.Value ? null : reader["aciklama"].ToString(),
            yildiz_sayisi = reader["yildiz_sayisi"] == DBNull.Value ? null : reader["yildiz_sayisi"],
            indirimlifiyat = reader["indirimlifiyat"] == DBNull.Value ? null : reader["indirimlifiyat"],
            yazar = reader["yazar"] == DBNull.Value ? null : reader["yazar"].ToString()
        };
        return Results.Ok(urun);
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// Kullanıcının profil bilgilerini (ad, soyad, eposta, telefon) güncelleyen POST endpoint
app.MapPost("/api/kullanici/guncelle", async (KullaniciGuncelleDto model) =>
{
    try
    {
        if (!Guid.TryParse(model.uye_id, out Guid guidUyeId))
            return Results.BadRequest(new { durum = false, mesaj = "Geçersiz üye ID formatı." });

        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string sql = @"UPDATE uye SET uye_ad = @ad, uye_soyad = @soyad, uye_eposta = @eposta, telefon = @telefon WHERE uye_id = @uye_id";
        using SqlCommand command = new(sql, connection);
        command.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = guidUyeId;
        command.Parameters.Add("@ad", SqlDbType.VarChar, 50).Value = model.ad;
        command.Parameters.Add("@soyad", SqlDbType.VarChar, 50).Value = model.soyad;
        command.Parameters.Add("@eposta", SqlDbType.VarChar, 100).Value = model.eposta;
        command.Parameters.Add("@telefon", SqlDbType.NVarChar, 20).Value = string.IsNullOrWhiteSpace(model.telefon) ? DBNull.Value : model.telefon.Trim();

        int etkilenen = await command.ExecuteNonQueryAsync();
        return etkilenen > 0 ? Results.Ok(new { durum = true, mesaj = "Profil bilgileri güncellendi." }) : Results.NotFound(new { durum = false, mesaj = "Kullanıcı bulunamadı." });
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// Mevcut şifreyi kontrol edip geçerliyse yeni şifreyi veritabanına kaydeden POST endpoint
app.MapPost("/api/kullanici/sifre-degistir", async (SifreDegistirDto model) =>
{
    try
    {
        if (!Guid.TryParse(model.uye_id, out Guid guidUyeId))
            return Results.BadRequest(new { durum = false, mesaj = "Geçersiz kullanıcı ID'si." });

        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string kontrolSql = "SELECT COUNT(1) FROM uye WHERE uye_id = @uye_id AND uye_sifre = @mevcut_sifre";
        using SqlCommand kontrolCmd = new(kontrolSql, connection);
        kontrolCmd.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = guidUyeId;
        kontrolCmd.Parameters.Add("@mevcut_sifre", SqlDbType.VarChar, 255).Value = model.mevcut_sifre;

        if (Convert.ToInt32(await kontrolCmd.ExecuteScalarAsync()) == 0)
            return Results.BadRequest(new { durum = false, mesaj = "Mevcut şifreniz hatalı!" });

        string guncelleSql = "UPDATE uye SET uye_sifre = @yeni_sifre WHERE uye_id = @uye_id";
        using SqlCommand guncelleCmd = new(guncelleSql, connection);
        guncelleCmd.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = guidUyeId;
        guncelleCmd.Parameters.Add("@yeni_sifre", SqlDbType.VarChar, 255).Value = model.yeni_sifre;

        await guncelleCmd.ExecuteNonQueryAsync();
        return Results.Ok(new { durum = true, mesaj = "Şifreniz güncellendi." });
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// Kullanıcı hesabını fiziksel olarak silmek yerine durumunu 'Pasif'e çeken Soft-Delete endpoint'i
app.MapPost("/api/kullanici/sil", async (UyelikSilDto model) =>
{
    try
    {
        if (!Guid.TryParse(model.uye_id, out Guid guidUyeId))
            return Results.BadRequest(new { durum = false, mesaj = "Geçersiz kullanıcı ID'si." });

        using SqlConnection connection = new(connectionString);
        await connection.OpenAsync();
        string silSql = "UPDATE uye SET aktivite = 'Pasif' WHERE uye_id = @uye_id;";
        using SqlCommand silCmd = new(silSql, connection);
        silCmd.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = guidUyeId;
        await silCmd.ExecuteNonQueryAsync();
        return Results.Ok(new { durum = true, mesaj = "Üyeliğiniz pasife alındı." });
    }
    catch (Exception ex) { return Results.Problem(detail: ex.Message, statusCode: 500); }
});

// ============================================================
// IYZICO SANDBOX AYARLARI
// ============================================================

// iyzico Sandbox test ortamı için API anahtarlarını yapılandırır
Options GetIyziOptions()
{
    return new Options
    {
        ApiKey = "sandbox-Xa6d5LleL9d88nccUbO6pajJaQ6R7DZI",
        SecretKey = "sandbox-bb7oTcte1smisPxsRY5nRjN2bWS2a3GT",
        BaseUrl = "https://sandbox-api.iyzipay.com"
    };
}

// ============================================================
// IYZICO ÖDEME BAŞLAT (/api/payment/start)
// ============================================================

// iyzico Checkout Form başlatma isteğini hazırlar ve dönen token ile sipariş bilgilerini RAM'deki havuzda saklar
app.MapPost("/api/payment/start", async (CheckoutRequestDto dto) =>
{
    try
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return Results.BadRequest(new { status = "failure", message = "Sepet boş." });

        var options = GetIyziOptions();
        var culture = CultureInfo.InvariantCulture;
        string formattedTotalPrice = dto.TotalPrice.ToString("0.00", culture);
        string conversationId = Guid.NewGuid().ToString();

        // Sepetteki ürünleri iyzico BasketItem modeline dönüştürme
        var basketItems = dto.Items.Select((item, index) => new BasketItem
        {
            Id = string.IsNullOrEmpty(item.Id) ? (index + 1).ToString() : item.Id,
            Name = string.IsNullOrEmpty(item.Name) ? "Ürün" : item.Name,
            Category1 = string.IsNullOrEmpty(item.Category) ? "Genel" : item.Category,
            ItemType = BasketItemType.PHYSICAL.ToString(),
            Price = item.Price.ToString("0.00", culture)
        }).ToList();

        // Ürün fiyatları toplamı genel toplamdan küçükse aradaki farkı (kargo ücreti) sanal ürün olarak ekle
        decimal itemsSum = dto.Items.Sum(x => x.Price);
        if (dto.TotalPrice > itemsSum)
        {
            basketItems.Add(new BasketItem
            {
                Id = "SHIPPING_FEE",
                Name = "Kargo Ücreti",
                Category1 = "Kargo",
                ItemType = BasketItemType.VIRTUAL.ToString(),
                Price = (dto.TotalPrice - itemsSum).ToString("0.00", culture)
            });
        }

        // Test için teslimat ve fatura adres şablonları
        var shippingAddress = new Address { ContactName = "Müsteri Test", City = "Istanbul", Country = "Turkey", Description = "Ornek Mah.", ZipCode = "34742" };
        var billingAddress = new Address { ContactName = "Müsteri Test", City = "Istanbul", Country = "Turkey", Description = "Ornek Mah.", ZipCode = "34742" };

        // iyzico API istek gövdesi
        var request = new CreateCheckoutFormInitializeRequest
        {
            Locale = Locale.TR.ToString(),
            ConversationId = conversationId,
            Price = formattedTotalPrice,
            PaidPrice = formattedTotalPrice,
            Currency = Currency.TRY.ToString(),
            BasketId = "BASKET-" + DateTime.UtcNow.Ticks,
            PaymentGroup = PaymentGroup.PRODUCT.ToString(),
            CallbackUrl = "http://localhost:5192/api/payment/callback",

            Buyer = new Buyer
            {
                Id = dto.uye_id ?? "BY-101",
                Name = "Musteri",
                Surname = "Test",
                GsmNumber = "+905350000000",
                Email = "test@example.com",
                IdentityNumber = "11111111111",
                RegistrationAddress = "Ornek Mah.",
                City = "Istanbul",
                Country = "Turkey",
                Ip = "85.34.78.112"
            },
            ShippingAddress = shippingAddress,
            BillingAddress = billingAddress,
            BasketItems = basketItems
        };

        // Asenkron çağrı (AWAIT EKLENDİ)
        var checkoutFormInitialize = await CheckoutFormInitialize.Create(request, options);

        if (checkoutFormInitialize.Status == "success")
        {
            if (Guid.TryParse(dto.uye_id, out Guid guidUyeId))
            {
                pendingOrders[checkoutFormInitialize.Token] = new sipariskayitmodel
                {
                    uye_id = guidUyeId,
                    toplam_ucret = dto.TotalPrice,
                    adres = dto.adres ?? "Adres Belirtilmedi",
                    urunler = dto.urunler ?? "[]"
                };
            }

            return Results.Ok(new
            {
                status = "success",
                checkoutFormContent = checkoutFormInitialize.CheckoutFormContent,
                token = checkoutFormInitialize.Token
            });
        }

        return Results.BadRequest(new { status = "failure", message = checkoutFormInitialize.ErrorMessage });
    }
    catch (Exception ex)
    {
        Console.WriteLine("[IYZICO BAŞLATMA HATASI]: " + ex.Message);
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// ============================================================
// IYZICO CALLBACK (/api/payment/callback)
// ============================================================

// Kullanıcı iyzico formunda ödemeyi tamamladığında iyzico'nun POST attığı geri dönüş endpoint'i
app.MapPost("/api/payment/callback", async (HttpRequest request) =>
{
    try
    {
        var form = await request.ReadFormAsync();
        string? token = form["token"];

        if (string.IsNullOrEmpty(token))
            return Results.Content("<h2>Geçersiz ödeme isteği (Token bulunamadı).</h2>", "text/html");

        var options = GetIyziOptions();
        var retrieveRequest = new RetrieveCheckoutFormRequest { Token = token };

        // Asenkron çağrı (AWAIT EKLENDİ)
        var checkoutForm = await CheckoutForm.Retrieve(retrieveRequest, options);

        if (checkoutForm != null && checkoutForm.PaymentStatus == "SUCCESS")
        {
            // Ödeme Başarılı -> SQL'e INSERT atıyoruz:
            if (!string.IsNullOrEmpty(token) && pendingOrders.TryRemove(token, out var siparisBilgi))
            {
                try
                {
                    using SqlConnection connection = new(connectionString);
                    await connection.OpenAsync();

                    string insertQuery = @"INSERT INTO siparis (uye_id, toplam_ucret, adres, urunler)
                                           VALUES (@uye_id, @toplam_ucret, @adres, @urunler)";

                    using SqlCommand cmd = new(insertQuery, connection);
                    cmd.Parameters.Add("@uye_id", SqlDbType.UniqueIdentifier).Value = siparisBilgi.uye_id;
                    cmd.Parameters.Add("@toplam_ucret", SqlDbType.Decimal).Value = siparisBilgi.toplam_ucret;
                    cmd.Parameters.Add("@adres", SqlDbType.NVarChar, -1).Value = siparisBilgi.adres;
                    cmd.Parameters.Add("@urunler", SqlDbType.NVarChar, -1).Value = siparisBilgi.urunler;

                    await cmd.ExecuteNonQueryAsync();
                    Console.WriteLine("[BAŞARILI]: Sipariş SQL tablosuna kaydedildi!");
                }
                catch (Exception sqlEx)
                {
                    Console.WriteLine("[CALLBACK SQL HATASI]: " + sqlEx.Message);
                }
            }

            string htmlSuccess = @"
<!DOCTYPE html>
<html lang='tr'>
<head>
    <meta charset='UTF-8'>
    <title>Ödeme Başarılı</title>
    <meta http-equiv='refresh' content='2;url=http://localhost:5500/siparis.html?clearCart=true'>
</head>
<body style='font-family:sans-serif;text-align:center;padding-top:50px;'>
    <h1 style='color:#10b981;'>🎉 Ödeme Başarıyla Tamamlandı!</h1>
    <p>Siparişiniz sisteme kaydedildi. Yönlendiriliyorsunuz...</p>
    <a href='http://localhost:5500/siparis.html?clearCart=true' style='display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Siparişlerime Git</a>
    
    <iframe src='http://localhost:5500/siparis.html?clearCart=true' style='display:none;'></iframe>
</body>
</html>";
            return Results.Content(htmlSuccess, "text/html");
        }
        else
        {
            string err = checkoutForm?.ErrorMessage ?? "Ödeme işlemi gerçekleştirilemedi.";
            string htmlFail = $@"
<!DOCTYPE html>
<html lang='tr'>
<head><meta charset='UTF-8'><title>Ödeme Başarısız</title></head>
<body style='font-family:sans-serif;text-align:center;padding-top:50px;'>
    <h1 style='color:#ef4444;'>❌ Ödeme Başarısız Oldu</h1>
    <p>Hata: {err}</p>
    <a href='http://localhost:5500/sepet.html' style='display:inline-block;padding:10px 20px;background:#64748b;color:#fff;text-decoration:none;border-radius:6px;'>Sepete Geri Dön</a>
</body>
</html>";
            return Results.Content(htmlFail, "text/html");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine("[IYZICO CALLBACK HATASI]: " + ex.Message);
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

app.MapControllers();
app.Run();

// ============================================================
// DTO VE MODEL TANIMLARI
// ============================================================

// Üyelik silme (Soft-Delete) DTO nesnesi
public record UyelikSilDto(string uye_id, string eposta, string sifre);

// Şifre değiştirme DTO nesnesi
public record SifreDegistirDto(string uye_id, string mevcut_sifre, string yeni_sifre);

// Kullanıcı profil bilgileri güncelleme DTO nesnesi
public record KullaniciGuncelleDto(string uye_id, string ad, string soyad, string eposta, string? telefon);

// Yeni üye kayıt modeli
public class UyeKayitModel
{
    public string uye_ad { get; set; } = string.Empty;
    public string uye_soyad { get; set; } = string.Empty;
    public string uye_eposta { get; set; } = string.Empty;
    public string uye_sifre { get; set; } = string.Empty;
    public string? telefon { get; set; }
}

// SQL 'siparis' tablosu kayıt modeli
public class sipariskayitmodel
{
    public Guid uye_id { get; set; }
    public decimal toplam_ucret { get; set; }
    public string adres { get; set; } = string.Empty;
    public string urunler { get; set; } = string.Empty;
}

// Frontend'den gelen iyzico checkout başlatma istek modeli
public class CheckoutRequestDto
{
    public decimal TotalPrice { get; set; }
    public List<CartItemDto> Items { get; set; } = new();
    public string? uye_id { get; set; }
    public string? adres { get; set; }
    public string? urunler { get; set; }
}

// iyzico sepetteki tekil ürün modeli
public class CartItemDto
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public decimal Price { get; set; }
    public string? Category { get; set; }
}