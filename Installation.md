Kurulum Rehberi

Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları takip edin:

1. Veritabanı Entegrasyonu

SQL Server üzerinde veritabanı oluşturun.
Verilerinizi uye, siparis, kitaplar, elektronik, hobi ve kirtasiye isimli tablolara aktarın.
Backend projesindeki Program.cs dosyasını açıp connectionString kısmını kendi SQL sunucu adınıza ve veritabanı adınıza göre güncelleyin.

2. Backend & Port Ayarları

Terminalde proje dizinine gidip API'yi başlatın:

Bash
dotnet run

Port Güncellemesi: Terminalin verdiği yerel sunucu adresini (Örn: http://localhost:5192) kontrol edin. Eğer .NET farklı bir port verdiyse, projedeki JavaScript fonksiyonlarında geçen fetch adreslerindeki port numaralarını yeni adresinizle güncelleyin.

3. Frontend Başlatma

Projeyi VS Code ile açın.

index.html dosyasını Live Server ile (5500 portunda) çalıştırın.
