# Quizly

**Python / FastAPI**, **Vue 3** ve **SQLite** ile geliştirilmiş Türkçe bir bilgi yarışması uygulaması. Konu seç, test çöz, sonuçlarını incele ve yanlışlarını tekrar çalış.

Arayüz için ayrı bir derleme adımı gerekmez. Vue proje içinde bulunur. Google Fonts yüklenemezse sistem yazı tipleri kullanılır.

## Kurulum ve çalıştırma

Python 3.10 veya üzeri gerekir. PowerShell'de proje klasörünü açıp şu komutları çalıştır:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Sanal ortam zaten varsa ilk komutu atlayabilirsin.

- **Uygulama:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Etkileşimli API belgeleri:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

macOS ve Linux'ta sanal ortamı `python3 -m venv .venv` ile oluştur. Sonraki komutlarda `.\.venv\Scripts\python.exe` yerine `.venv/bin/python` kullan.

Veritabanı ilk çalıştırmada otomatik oluşturulur. Uygulamayı kullanmak için Node.js kurulması gerekmez; Node.js yalnızca isteğe bağlı arayüz testlerinde kullanılır.

## Kategoriler ve soru havuzu

Uygulama **8 kategori, 16 test ve 80 hazır soru** içerir. Her kategoride beşer soruluk iki test, kısa bir konu açıklaması ve konuya uygun bir SVG simgesi bulunur.

| Kategori | İçerik |
| --- | --- |
| Bilim | Uzay, fizik ve temel bilimler |
| Matematik ve Mantık | Sayılar, şekiller ve akıl yürütme |
| Teknoloji | Bilgisayarlar ve dijital dünya |
| Coğrafya | Dünya, ülkeler ve Türkiye |
| Tarih | Uygarlıklar ve geçmişten dönüm noktaları |
| Sanat ve Edebiyat | Resim, müzik, kitaplar ve kültür |
| Doğa ve Çevre | Canlılar, ekosistemler ve gezegenimiz |
| Genel Kültür | Günlük yaşamdan farklı bilgiler |

## Özellikler

- Türkçe arama, kategori ve zorluk filtreleri, sıralama ve test kaydetme.
- Açık ve koyu tema; kart ve liste görünümleri. Görünüm tercihleri tarayıcıda hatırlanır.
- Mobilde alt menü, masaüstünde geniş test kartları.
- Sorular arasında gezinme, geçen süreyi görme ve testten çıkarken onay ekranı.
- Sunucuda puanlama, doğru yanıt açıklamaları ve kalıcı sonuç geçmişi.
- **Yanlışları çalış:** Tamamlanan bir testteki yalnızca yanlış sorulardan yeni bir tekrar çalışması başlatma.
- **Güven düzeyi:** Her yanıtta isteğe bağlı olarak “Tahmin ettim”, “Kısmen eminim” veya “Eminim” seçme; sonuçlarda emin olunan yanlışları filtreleme.
- Son yedi günlük etkinlik, son test puanları, konuya göre başarı ve kişisel en iyi sonuçlar.
- Her soruda dört seçenek içeren, 1–20 soruluk kişisel test oluşturma.
- Klavye kullanımı, görünür odak işaretleri, erişilebilir etiketler ve azaltılmış hareket tercihine destek.

### Tekrar çalışmaları ve puanlar

Sonuç ekranından veya **Gelişimim** bölümünden yanlış sorularını tekrar çözebilirsin. Sorular, ilk deneme sırasında kaydedilen içerikten alınır; soru havuzundaki sonraki değişiklikler o denemeyi etkilemez.

Tekrar sonuçları geçmişte **TEKRAR** etiketiyle görünür ve günlük etkinliğe eklenir. Genel puan ortalaması, en iyi sonuçlar ve konuya göre başarı yalnızca tam test denemelerinden hesaplanır. Konu başarısı, o konudaki toplam doğru sayısının toplam soru sayısına oranıdır. Gelişim ekranındaki tekrar önerileri, her testin son tam denemesindeki yanlışlara dayanır.

Güven düzeyi puanı etkilemez. Seçtiğin düzeye yeniden tıklayarak seçimi kaldırabilirsin. Sorular arasında gezinirken seçimler korunur. Güven bilgisi içermeyen eski sonuçlar da görüntülenebilir.

### Klavye kısayolları

| Tuş | İşlev |
| --- | --- |
| `/` | Test listesinde arama alanına odaklanır. |
| `1`–`4` | Test sırasında bir yanıt seçer. |
| `Enter` | Yanıt verilmişse sonraki soruya geçer; son soruda tüm yanıtlar tamamlanmışsa testi gönderir. |

Metin alanlarında yazarken kısayollar devreye girmez. Bir düğme veya bağlantı odaktayken `Enter`, o öğenin normal işlevini yerine getirir. Çıkış onay penceresi açıkken test kısayolları çalışmaz.

## Dil ve veri saklama

Arayüz, hazır sorular, açıklamalar ve kullanıcıya gösterilen mesajlar Türkçedir. Tarih biçimlendirme ve büyük/küçük harf duyarsız arama `tr-TR` dil ayarını kullanır. Mevcut veriler ve API istemcileriyle uyumluluk için kategori ve zorluk kodları sabit tutulur.

Uygulama üyelik gerektirmeyen bir misafir profili kullanır. Profil, `HttpOnly` tarayıcı çereziyle tanınır. Kişisel testler, kaydedilen testler ve sonuçlar bu profile aittir. Çerezi silmek yeni bir profil oluşturur; hesapla giriş veya cihazlar arasında eşitleme bulunmaz. Kişisel testlere yalnızca onları oluşturan profil erişebilir.

Gönderilmemiş yanıtlar sayfa belleğinde tutulur ve sayfa yenilenirse kaybolur. Sayaç bilgi amaçlıdır; süre dolması nedeniyle test sonlandırılmaz. Doğru yanıtlar, testi başlatan API yanıtında gönderilmez.

Veriler varsayılan olarak `data/quizly.db` dosyasında saklanır. Farklı bir dosya kullanmak için uygulamayı başlatmadan önce `QUIZLY_DB` ortam değişkenini ayarla:

```powershell
$env:QUIZLY_DB = 'C:\Python\QuizWebApp\data\alternatif.db'
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Hazır testler kimliklerine göre bir kez eklenir. `quizzes.json` dosyasına yeni kimlikler eklemek, sonraki başlangıçta yeni testleri veritabanına ekler. Var olan testleri değiştirmek için ayrıca bir veri geçişi gerekir; yeniden başlatmak kayıtlı içeriğin üzerine yazmaz.

Eski İngilizce kurulumlar için bulunan tek seferlik Türkçe veri geçişi, hazır testleri ve geçmiş denemelerin metinlerini çevirirken puanları, kaydedilen testleri, yanıt sıralamasını ve kullanıcı tarafından oluşturulan içeriği korur. Veritabanları, yedekler ve günlük dosyaları Git deposuna dahil edilmez.

## Testler

API testleri için:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

API testleri geçici ve birbirinden bağımsız veritabanları kullanır. Puanlama, tekrar gönderim, veri doğrulama, kalıcılık, profil erişim sınırları, kategori sayıları, yanlışlardan tekrar oluşturma ve güven düzeyi davranışını kontrol eder.

İsteğe bağlı arayüz testleri için Node.js 20 veya üzeri gerekir:

```powershell
npm.cmd ci
npm.cmd test
```

macOS ve Linux'ta `npm.cmd` yerine `npm` kullan.

Arayüz testleri Vue ekranlarını ve kullanıcı etkileşimlerini jsdom ortamında, örnek API yanıtlarıyla kontrol eder. Gerçek tarayıcıdaki görsel kontrollerin yerini tutmaz.

Son doğrulamada **26 API testi ve 15 arayüz etkileşim testi** geçti. CSS ayrıştırma kontrolü de başarılı oldu. Yerel sunucu ana sayfayı, API belgelerini ve arayüz dosyalarını HTTP 200 yanıtıyla sundu; katalogda 16 test ve 80 soru doğrulandı. Geliştirme oturumuna bağlı tarayıcı olmadığı için gerçek tarayıcıda görsel doğrulama yapılamadı.

## Proje yapısı

| Dosya veya klasör | Görevi |
| --- | --- |
| `main.py` | FastAPI uç noktaları, istek modelleri, SQLite işlemleri ve puanlama. |
| `quizzes.json` | Başlangıç soru havuzu. |
| `categories.json` | Türkçe kategori adları, açıklamaları, renkleri ve simgeleri; `/api/categories` üzerinden sunulur. |
| `migrations/` | Mevcut verileri koruyan veri geçişleri. |
| `static/index.html` | Vue arayüz şablonları. |
| `static/app.js` | Gezinme, kullanıcı etkileşimleri ve API istemcisi. |
| `static/style.css` | Farklı ekran boyutlarına uyarlanan tasarım ve temalar. |
| `static/vendor/vue.global.prod.js` | Projeye dahil edilmiş Vue 3.5.22 çalışma zamanı; MIT lisanslıdır. |
| `tests/` | API ve arayüz regresyon testleri. |
| `requirements.txt` | Uygulamayı çalıştırmak için gereken Python bağımlılıkları. |
| `requirements-dev.txt` | Python test bağımlılıkları. |
| `package.json` ve `package-lock.json` | Arayüz test araçları ve kilitlenmiş bağımlılık ağacı. |

## Yararlanılan belgeler

- [FastAPI öğrenme rehberi](https://fastapi.tiangolo.com/learn/)
- [İstek gövdeleri ve Pydantic doğrulaması](https://fastapi.tiangolo.com/tutorial/body/)
- [Statik dosyalar](https://fastapi.tiangolo.com/tutorial/static-files/)
- [TestClient ile test yazma](https://fastapi.tiangolo.com/tutorial/testing/)
- [Vue'yu derleme adımı olmadan kullanma](https://vuejs.org/guide/quick-start.html#using-vue-from-cdn)
