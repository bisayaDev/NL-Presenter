// Strings shown by the main process: native file dialogs, message boxes, window titles, screen notices and
// errors that reach the UI. Looked up with tm() / tmn() from src/main/i18n.ts (language = setting `language`).
// Same format as the UI area files: every language side by side. Data only: no imports but types.
import type { AreaStrings } from './i18n-core'

export default {
  // ----- windows -----
  'main.window.output': {
    en: 'NLPresenter Output', tl: 'NLPresenter Output', es: 'NLPresenter Salida', pt: 'NLPresenter Saída', fr: 'NLPresenter Sortie',
    it: 'NLPresenter Uscita', ko: 'NLPresenter 출력', zh: 'NLPresenter 输出', id: 'NLPresenter Output', hi: 'NLPresenter आउटपुट',
    ta: 'NLPresenter வெளியீடு', ru: 'NLPresenter Вывод', uk: 'NLPresenter Вивід'
  },
  'main.window.stage': {
    en: 'NLPresenter Stage', tl: 'NLPresenter Stage', es: 'NLPresenter Escenario', pt: 'NLPresenter Palco', fr: 'NLPresenter Scène',
    it: 'NLPresenter Palco', ko: 'NLPresenter 무대', zh: 'NLPresenter 舞台', id: 'NLPresenter Panggung', hi: 'NLPresenter स्टेज',
    ta: 'NLPresenter மேடை', ru: 'NLPresenter Сцена', uk: 'NLPresenter Сцена'
  },
  'main.quitBackup': {
    en: 'NLPresenter: saving a backup before closing…', tl: 'NLPresenter: nagse-save ng backup bago magsara…',
    es: 'NLPresenter: guardando una copia antes de cerrar…', pt: 'NLPresenter: salvando um backup antes de fechar…',
    fr: 'NLPresenter : sauvegarde avant fermeture…', it: 'NLPresenter: salvataggio del backup prima di chiudere…',
    ko: 'NLPresenter: 닫기 전에 백업 저장 중…', zh: 'NLPresenter：关闭前正在保存备份…', id: 'NLPresenter: menyimpan cadangan sebelum menutup…',
    hi: 'NLPresenter: बंद करने से पहले बैकअप सहेजा जा रहा है…', ta: 'NLPresenter: மூடும் முன் காப்புப்பிரதி சேமிக்கப்படுகிறது…',
    ru: 'NLPresenter: сохраняем резервную копию перед закрытием…', uk: 'NLPresenter: зберігаємо резервну копію перед закриттям…'
  },

  // ----- file dialogs -----
  'main.dlg.exportUsage': {
    en: 'Export song usage', tl: 'I-export ang paggamit ng kanta', es: 'Exportar uso de canciones', pt: 'Exportar uso de músicas',
    fr: 'Exporter l’utilisation des chants', it: 'Esporta utilizzo dei canti', ko: '곡 사용 기록 내보내기', zh: '导出歌曲使用记录',
    id: 'Ekspor penggunaan lagu', hi: 'गीत उपयोग निर्यात करें', ta: 'பாடல் பயன்பாட்டை ஏற்றுமதி செய்', ru: 'Экспорт использования песен',
    uk: 'Експорт використання пісень'
  },
  'main.dlg.importMusic': {
    en: 'Import music', tl: 'Mag-import ng musika', es: 'Importar música', pt: 'Importar música', fr: 'Importer de la musique',
    it: 'Importa musica', ko: '음악 가져오기', zh: '导入音乐', id: 'Impor musik', hi: 'संगीत आयात करें', ta: 'இசையை இறக்கு',
    ru: 'Импорт музыки', uk: 'Імпорт музики'
  },
  'main.dlg.importMedia': {
    en: 'Import images, videos, audio or background loops', tl: 'Mag-import ng larawan, video, audio o background loop',
    es: 'Importar imágenes, vídeos, audio o fondos en bucle', pt: 'Importar imagens, vídeos, áudio ou fundos em loop',
    fr: 'Importer images, vidéos, audio ou fonds animés', it: 'Importa immagini, video, audio o sfondi in loop',
    ko: '이미지, 동영상, 오디오, 배경 루프 가져오기', zh: '导入图片、视频、音频或循环背景', id: 'Impor gambar, video, audio, atau latar berulang',
    hi: 'चित्र, वीडियो, ऑडियो या बैकग्राउंड लूप आयात करें', ta: 'படங்கள், வீடியோ, ஆடியோ அல்லது பின்னணி லூப்களை இறக்கு',
    ru: 'Импорт изображений, видео, аудио или фоновых циклов', uk: 'Імпорт зображень, відео, аудіо або фонових циклів'
  },
  'main.dlg.importDeck': {
    en: 'Import a presentation', tl: 'Mag-import ng presentation', es: 'Importar una presentación', pt: 'Importar uma apresentação',
    fr: 'Importer une présentation', it: 'Importa una presentazione', ko: '프레젠테이션 가져오기', zh: '导入演示文稿', id: 'Impor presentasi',
    hi: 'प्रेज़ेंटेशन आयात करें', ta: 'விளக்கக்காட்சியை இறக்கு', ru: 'Импорт презентации', uk: 'Імпорт презентації'
  },
  'main.dlg.linkFolder': {
    en: 'Link a folder of pictures and videos', tl: 'I-link ang folder ng mga larawan at video', es: 'Vincular una carpeta de imágenes y vídeos',
    pt: 'Vincular uma pasta de imagens e vídeos', fr: 'Lier un dossier d’images et de vidéos', it: 'Collega una cartella di immagini e video',
    ko: '사진·동영상 폴더 연결', zh: '链接图片和视频文件夹', id: 'Tautkan folder gambar dan video', hi: 'चित्रों और वीडियो का फ़ोल्डर जोड़ें',
    ta: 'படங்கள், வீடியோ கோப்புறையை இணை', ru: 'Подключить папку с фото и видео', uk: 'Під’єднати теку з фото й відео'
  },
  'main.dlg.saveBackup': {
    en: 'Save full backup', tl: 'I-save ang buong backup', es: 'Guardar copia completa', pt: 'Salvar backup completo',
    fr: 'Enregistrer une sauvegarde complète', it: 'Salva backup completo', ko: '전체 백업 저장', zh: '保存完整备份', id: 'Simpan cadangan lengkap',
    hi: 'पूरा बैकअप सहेजें', ta: 'முழு காப்புப்பிரதியைச் சேமி', ru: 'Сохранить полную копию', uk: 'Зберегти повну копію'
  },
  'main.dlg.restoreBackup': {
    en: 'Restore from backup', tl: 'I-restore mula sa backup', es: 'Restaurar desde copia', pt: 'Restaurar do backup',
    fr: 'Restaurer une sauvegarde', it: 'Ripristina da backup', ko: '백업에서 복원', zh: '从备份恢复', id: 'Pulihkan dari cadangan',
    hi: 'बैकअप से पुनर्स्थापित करें', ta: 'காப்புப்பிரதியிலிருந்து மீட்டமை', ru: 'Восстановить из копии', uk: 'Відновити з копії'
  },
  'main.dlg.backupFolder': {
    en: 'Folder for automatic backups', tl: 'Folder para sa awtomatikong backup', es: 'Carpeta para copias automáticas',
    pt: 'Pasta para backups automáticos', fr: 'Dossier des sauvegardes automatiques', it: 'Cartella per i backup automatici',
    ko: '자동 백업 폴더', zh: '自动备份文件夹', id: 'Folder untuk cadangan otomatis', hi: 'स्वचालित बैकअप का फ़ोल्डर',
    ta: 'தானியங்கு காப்புப்பிரதி கோப்புறை', ru: 'Папка для автокопий', uk: 'Тека для автокопій'
  },
  'main.dlg.exportSongs': {
    en: { one: 'Export {count} song as .txt', other: 'Export {count} songs as .txt' },
    tl: { one: 'I-export ang {count} kanta bilang .txt', other: 'I-export ang {count} kanta bilang .txt' },
    es: { one: 'Exportar {count} canción como .txt', other: 'Exportar {count} canciones como .txt' },
    pt: { one: 'Exportar {count} música como .txt', other: 'Exportar {count} músicas como .txt' },
    fr: { one: 'Exporter {count} chant en .txt', other: 'Exporter {count} chants en .txt' },
    it: { one: 'Esporta {count} canto come .txt', other: 'Esporta {count} canti come .txt' },
    ko: { other: '곡 {count}개를 .txt로 내보내기' },
    zh: { other: '将 {count} 首歌曲导出为 .txt' },
    id: { other: 'Ekspor {count} lagu sebagai .txt' },
    hi: { one: '{count} गीत .txt के रूप में निर्यात करें', other: '{count} गीत .txt के रूप में निर्यात करें' },
    ta: { one: '{count} பாடலை .txt ஆக ஏற்றுமதி செய்', other: '{count} பாடல்களை .txt ஆக ஏற்றுமதி செய்' },
    ru: { one: 'Экспорт {count} песни в .txt', few: 'Экспорт {count} песен в .txt', many: 'Экспорт {count} песен в .txt', other: 'Экспорт {count} песни в .txt' },
    uk: { one: 'Експорт {count} пісні в .txt', few: 'Експорт {count} пісень у .txt', many: 'Експорт {count} пісень у .txt', other: 'Експорт {count} пісні в .txt' }
  },
  'main.dlg.exportHere': {
    en: 'Export here', tl: 'I-export dito', es: 'Exportar aquí', pt: 'Exportar aqui', fr: 'Exporter ici', it: 'Esporta qui',
    ko: '여기로 내보내기', zh: '导出到此处', id: 'Ekspor di sini', hi: 'यहाँ निर्यात करें', ta: 'இங்கே ஏற்றுமதி செய்', ru: 'Экспортировать сюда',
    uk: 'Експортувати сюди'
  },
  'main.dlg.importSongs': {
    en: 'Import songs from .txt', tl: 'Mag-import ng kanta mula sa .txt', es: 'Importar canciones desde .txt', pt: 'Importar músicas de .txt',
    fr: 'Importer des chants depuis .txt', it: 'Importa canti da .txt', ko: '.txt에서 곡 가져오기', zh: '从 .txt 导入歌曲', id: 'Impor lagu dari .txt',
    hi: '.txt से गीत आयात करें', ta: '.txt இலிருந்து பாடல்களை இறக்கு', ru: 'Импорт песен из .txt', uk: 'Імпорт пісень із .txt'
  },
  'main.dlg.importBible': {
    en: 'Import Bible (XML)', tl: 'Mag-import ng Bibliya (XML)', es: 'Importar Biblia (XML)', pt: 'Importar Bíblia (XML)',
    fr: 'Importer une Bible (XML)', it: 'Importa Bibbia (XML)', ko: '성경 가져오기 (XML)', zh: '导入圣经 (XML)', id: 'Impor Alkitab (XML)',
    hi: 'बाइबल आयात करें (XML)', ta: 'வேதாகமத்தை இறக்கு (XML)', ru: 'Импорт Библии (XML)', uk: 'Імпорт Біблії (XML)'
  },
  'main.dlg.savePdf': {
    en: 'Save PDF', tl: 'I-save ang PDF', es: 'Guardar PDF', pt: 'Salvar PDF', fr: 'Enregistrer le PDF', it: 'Salva PDF', ko: 'PDF 저장',
    zh: '保存 PDF', id: 'Simpan PDF', hi: 'PDF सहेजें', ta: 'PDF சேமி', ru: 'Сохранить PDF', uk: 'Зберегти PDF'
  },

  // ----- file type filters -----
  'main.filter.allMedia': {
    en: 'Images, videos, audio, loops and presentations', tl: 'Larawan, video, audio, loop at presentation',
    es: 'Imágenes, vídeos, audio, bucles y presentaciones', pt: 'Imagens, vídeos, áudio, loops e apresentações',
    fr: 'Images, vidéos, audio, boucles et présentations', it: 'Immagini, video, audio, loop e presentazioni',
    ko: '이미지, 동영상, 오디오, 루프, 프레젠테이션', zh: '图片、视频、音频、循环和演示文稿', id: 'Gambar, video, audio, loop, dan presentasi',
    hi: 'चित्र, वीडियो, ऑडियो, लूप और प्रेज़ेंटेशन', ta: 'படங்கள், வீடியோ, ஆடியோ, லூப், விளக்கக்காட்சிகள்',
    ru: 'Изображения, видео, аудио, циклы и презентации', uk: 'Зображення, відео, аудіо, цикли й презентації'
  },
  'main.filter.images': {
    en: 'Images', tl: 'Mga larawan', es: 'Imágenes', pt: 'Imagens', fr: 'Images', it: 'Immagini', ko: '이미지', zh: '图片', id: 'Gambar',
    hi: 'चित्र', ta: 'படங்கள்', ru: 'Изображения', uk: 'Зображення'
  },
  'main.filter.videos': {
    en: 'Videos', tl: 'Mga video', es: 'Vídeos', pt: 'Vídeos', fr: 'Vidéos', it: 'Video', ko: '동영상', zh: '视频', id: 'Video', hi: 'वीडियो',
    ta: 'வீடியோக்கள்', ru: 'Видео', uk: 'Відео'
  },
  'main.filter.audio': {
    en: 'Audio', tl: 'Audio', es: 'Audio', pt: 'Áudio', fr: 'Audio', it: 'Audio', ko: '오디오', zh: '音频', id: 'Audio', hi: 'ऑडियो',
    ta: 'ஆடியோ', ru: 'Аудио', uk: 'Аудіо'
  },
  'main.filter.loops': {
    en: 'Background loops (.json)', tl: 'Background loop (.json)', es: 'Fondos en bucle (.json)', pt: 'Fundos em loop (.json)',
    fr: 'Fonds animés (.json)', it: 'Sfondi in loop (.json)', ko: '배경 루프 (.json)', zh: '循环背景 (.json)', id: 'Latar berulang (.json)',
    hi: 'बैकग्राउंड लूप (.json)', ta: 'பின்னணி லூப்கள் (.json)', ru: 'Фоновые циклы (.json)', uk: 'Фонові цикли (.json)'
  },
  'main.filter.decks': {
    en: 'Presentations (PDF, PowerPoint, Keynote)', tl: 'Presentation (PDF, PowerPoint, Keynote)',
    es: 'Presentaciones (PDF, PowerPoint, Keynote)', pt: 'Apresentações (PDF, PowerPoint, Keynote)',
    fr: 'Présentations (PDF, PowerPoint, Keynote)', it: 'Presentazioni (PDF, PowerPoint, Keynote)', ko: '프레젠테이션 (PDF, PowerPoint, Keynote)',
    zh: '演示文稿 (PDF, PowerPoint, Keynote)', id: 'Presentasi (PDF, PowerPoint, Keynote)', hi: 'प्रेज़ेंटेशन (PDF, PowerPoint, Keynote)',
    ta: 'விளக்கக்காட்சிகள் (PDF, PowerPoint, Keynote)', ru: 'Презентации (PDF, PowerPoint, Keynote)', uk: 'Презентації (PDF, PowerPoint, Keynote)'
  },
  'main.filter.backup': {
    en: 'NLPresenter backup', tl: 'Backup ng NLPresenter', es: 'Copia de NLPresenter', pt: 'Backup do NLPresenter', fr: 'Sauvegarde NLPresenter',
    it: 'Backup di NLPresenter', ko: 'NLPresenter 백업', zh: 'NLPresenter 备份', id: 'Cadangan NLPresenter', hi: 'NLPresenter बैकअप',
    ta: 'NLPresenter காப்புப்பிரதி', ru: 'Копия NLPresenter', uk: 'Копія NLPresenter'
  },
  'main.filter.songs': {
    en: 'Song files (text, ChordPro, SongSelect)', tl: 'Mga song file (text, ChordPro, SongSelect)', es: 'Archivos de canciones (texto, ChordPro, SongSelect)',
    pt: 'Arquivos de músicas (texto, ChordPro, SongSelect)', fr: 'Fichiers de chants (texte, ChordPro, SongSelect)', it: 'File di canti (testo, ChordPro, SongSelect)',
    ko: '노래 파일 (텍스트, ChordPro, SongSelect)', zh: '歌曲文件（文本、ChordPro、SongSelect）', id: 'File lagu (teks, ChordPro, SongSelect)',
    hi: 'गीत फ़ाइलें (टेक्स्ट, ChordPro, SongSelect)', ta: 'பாடல் கோப்புகள் (உரை, ChordPro, SongSelect)', ru: 'Файлы песен (текст, ChordPro, SongSelect)', uk: 'Файли пісень (текст, ChordPro, SongSelect)'
  },
  'main.filter.text': {
    en: 'Text files', tl: 'Mga text file', es: 'Archivos de texto', pt: 'Arquivos de texto', fr: 'Fichiers texte', it: 'File di testo',
    ko: '텍스트 파일', zh: '文本文件', id: 'File teks', hi: 'टेक्स्ट फ़ाइलें', ta: 'உரைக் கோப்புகள்', ru: 'Текстовые файлы', uk: 'Текстові файли'
  },
  'main.filter.bibleXml': {
    en: 'Bible XML (Zefania and similar)', tl: 'Bible XML (Zefania at katulad)', es: 'Biblia XML (Zefania y similares)',
    pt: 'Bíblia XML (Zefania e similares)', fr: 'Bible XML (Zefania et similaires)', it: 'Bibbia XML (Zefania e simili)',
    ko: '성경 XML (Zefania 등)', zh: '圣经 XML（Zefania 等）', id: 'Alkitab XML (Zefania dan sejenisnya)', hi: 'बाइबल XML (Zefania आदि)',
    ta: 'வேதாகம XML (Zefania போன்றவை)', ru: 'Библия XML (Zefania и др.)', uk: 'Біблія XML (Zefania тощо)'
  },

  // ----- message boxes -----
  'main.msg.someFailed': {
    en: 'Some files could not be imported', tl: 'May mga file na hindi ma-import', es: 'Algunos archivos no se pudieron importar',
    pt: 'Alguns arquivos não puderam ser importados', fr: 'Certains fichiers n’ont pas pu être importés',
    it: 'Alcuni file non sono stati importati', ko: '일부 파일을 가져오지 못했습니다', zh: '部分文件无法导入', id: 'Beberapa file tidak dapat diimpor',
    hi: 'कुछ फ़ाइलें आयात नहीं हो सकीं', ta: 'சில கோப்புகளை இறக்க முடியவில்லை', ru: 'Некоторые файлы не удалось импортировать',
    uk: 'Деякі файли не вдалося імпортувати'
  },
  'main.err.notDeck': {
    en: 'Not a presentation file.', tl: 'Hindi ito presentation file.', es: 'No es un archivo de presentación.', pt: 'Não é um arquivo de apresentação.',
    fr: 'Ce n’est pas un fichier de présentation.', it: 'Non è un file di presentazione.', ko: '프레젠테이션 파일이 아닙니다.', zh: '不是演示文稿文件。',
    id: 'Bukan file presentasi.', hi: 'यह प्रेज़ेंटेशन फ़ाइल नहीं है।', ta: 'இது விளக்கக்காட்சி கோப்பு அல்ல.', ru: 'Это не файл презентации.',
    uk: 'Це не файл презентації.'
  },

  // ----- screens (notices in the operator window) -----
  'main.screen.output': {
    en: 'Output', tl: 'Output', es: 'Salida', pt: 'Saída', fr: 'Sortie', it: 'Uscita', ko: '출력', zh: '输出', id: 'Output', hi: 'आउटपुट',
    ta: 'வெளியீடு', ru: 'Вывод', uk: 'Вивід'
  },
  'main.screen.stage': {
    en: 'Stage screen', tl: 'Stage screen', es: 'Pantalla de escenario', pt: 'Tela de palco', fr: 'Écran de scène', it: 'Schermo palco',
    ko: '무대 화면', zh: '舞台屏幕', id: 'Layar panggung', hi: 'स्टेज स्क्रीन', ta: 'மேடைத் திரை', ru: 'Экран сцены', uk: 'Екран сцени'
  },
  'main.screen.display': {
    en: 'Display {n}', tl: 'Display {n}', es: 'Pantalla {n}', pt: 'Tela {n}', fr: 'Écran {n}', it: 'Schermo {n}', ko: '디스플레이 {n}',
    zh: '显示器 {n}', id: 'Layar {n}', hi: 'डिस्प्ले {n}', ta: 'திரை {n}', ru: 'Экран {n}', uk: 'Екран {n}'
  },
  'main.screen.lost': {
    en: '{name} lost. It comes back when the display does.', tl: 'Nawala ang {name}. Babalik ito kapag bumalik ang display.',
    es: '{name} perdida. Volverá cuando vuelva la pantalla.', pt: '{name} perdida. Volta quando a tela voltar.',
    fr: '{name} perdue. Elle reviendra avec l’écran.', it: '{name} persa. Tornerà quando torna lo schermo.',
    ko: '{name} 연결 끊김. 디스플레이가 돌아오면 다시 켜집니다.', zh: '{name}已断开。显示器恢复后会自动回来。',
    id: '{name} terputus. Akan kembali saat layar tersambung lagi.', hi: '{name} खो गया। डिस्प्ले लौटने पर यह वापस आएगा।',
    ta: '{name} துண்டிக்கப்பட்டது. திரை திரும்பும்போது இதுவும் வரும்.', ru: '{name}: связь потеряна. Вернётся вместе с экраном.',
    uk: '{name}: зв’язок втрачено. Повернеться разом з екраном.'
  },
  'main.screen.lostOn': {
    en: '{name} lost: {display} was disconnected. It comes back when the display does.',
    tl: 'Nawala ang {name}: na-disconnect ang {display}. Babalik ito kapag bumalik ang display.',
    es: '{name} perdida: se desconectó {display}. Volverá cuando vuelva la pantalla.',
    pt: '{name} perdida: {display} foi desconectada. Volta quando a tela voltar.',
    fr: '{name} perdue : {display} a été déconnecté. Elle reviendra avec l’écran.',
    it: '{name} persa: {display} è stato scollegato. Tornerà quando torna lo schermo.',
    ko: '{name} 연결 끊김: {display} 연결이 해제되었습니다. 디스플레이가 돌아오면 다시 켜집니다.',
    zh: '{name}已断开：{display} 已拔出。显示器恢复后会自动回来。',
    id: '{name} terputus: {display} dicabut. Akan kembali saat layar tersambung lagi.',
    hi: '{name} खो गया: {display} डिस्कनेक्ट हुआ। डिस्प्ले लौटने पर यह वापस आएगा।',
    ta: '{name} துண்டிக்கப்பட்டது: {display} இணைப்பு நீங்கியது. திரை திரும்பும்போது இதுவும் வரும்.',
    ru: '{name}: связь потеряна, {display} отключён. Вернётся вместе с экраном.',
    uk: '{name}: зв’язок втрачено, {display} від’єднано. Повернеться разом з екраном.'
  },
  'main.screen.failing': {
    en: '{name} keeps failing ({why}). Close it and open it again.', tl: 'Paulit-ulit na pumapalya ang {name} ({why}). Isara at buksan ulit.',
    es: '{name} sigue fallando ({why}). Ciérrela y ábrala de nuevo.', pt: '{name} continua falhando ({why}). Feche e abra de novo.',
    fr: '{name} plante sans cesse ({why}). Fermez-la puis rouvrez-la.', it: '{name} continua a bloccarsi ({why}). Chiudila e riaprila.',
    ko: '{name}에 계속 문제가 있습니다 ({why}). 닫았다가 다시 여세요.', zh: '{name}反复出错（{why}）。请关闭后重新打开。',
    id: '{name} terus gagal ({why}). Tutup lalu buka lagi.', hi: '{name} बार-बार विफल हो रहा है ({why})। इसे बंद करके फिर खोलें।',
    ta: '{name} மீண்டும் மீண்டும் தோல்வியடைகிறது ({why}). மூடி மீண்டும் திற.', ru: '{name}: постоянные сбои ({why}). Закройте и откройте снова.',
    uk: '{name}: постійні збої ({why}). Закрийте й відкрийте знову.'
  },
  'main.screen.restarted': {
    en: '{name} restarted ({why})', tl: 'Na-restart ang {name} ({why})', es: '{name} reiniciada ({why})', pt: '{name} reiniciada ({why})',
    fr: '{name} redémarrée ({why})', it: '{name} riavviata ({why})', ko: '{name} 다시 시작됨 ({why})', zh: '{name}已重启（{why}）',
    id: '{name} dimulai ulang ({why})', hi: '{name} फिर से शुरू हुआ ({why})', ta: '{name} மீண்டும் தொடங்கியது ({why})',
    ru: '{name}: перезапуск ({why})', uk: '{name}: перезапуск ({why})'
  },
  'main.screen.projectorBack': {
    en: 'Projector reconnected', tl: 'Nakakonekta ulit ang projector', es: 'Proyector reconectado', pt: 'Projetor reconectado',
    fr: 'Projecteur reconnecté', it: 'Proiettore ricollegato', ko: '프로젝터 다시 연결됨', zh: '投影仪已重新连接', id: 'Proyektor tersambung lagi',
    hi: 'प्रोजेक्टर फिर से जुड़ा', ta: 'புரொஜெக்டர் மீண்டும் இணைந்தது', ru: 'Проектор снова подключён', uk: 'Проєктор знову під’єднано'
  },
  'main.screen.stageBack': {
    en: 'Stage screen reconnected on {display}', tl: 'Nakakonekta ulit ang stage screen sa {display}',
    es: 'Pantalla de escenario reconectada en {display}', pt: 'Tela de palco reconectada em {display}',
    fr: 'Écran de scène reconnecté sur {display}', it: 'Schermo palco ricollegato su {display}', ko: '무대 화면이 {display}에 다시 연결됨',
    zh: '舞台屏幕已在 {display} 上重新连接', id: 'Layar panggung tersambung lagi di {display}', hi: 'स्टेज स्क्रीन {display} पर फिर से जुड़ी',
    ta: 'மேடைத் திரை {display} இல் மீண்டும் இணைந்தது', ru: 'Экран сцены снова на {display}', uk: 'Екран сцени знову на {display}'
  },

  // ----- automatic backups -----
  'main.auto.lowDisk': {
    en: 'Automatic backup skipped: less than 1 GB free in {dir}.', tl: 'Nilaktawan ang awtomatikong backup: kulang sa 1 GB ang bakante sa {dir}.',
    es: 'Copia automática omitida: menos de 1 GB libre en {dir}.', pt: 'Backup automático ignorado: menos de 1 GB livre em {dir}.',
    fr: 'Sauvegarde automatique ignorée : moins de 1 Go libre dans {dir}.', it: 'Backup automatico saltato: meno di 1 GB libero in {dir}.',
    ko: '자동 백업 건너뜀: {dir}의 여유 공간이 1GB 미만입니다.', zh: '已跳过自动备份：{dir} 的可用空间不足 1 GB。',
    id: 'Cadangan otomatis dilewati: ruang kosong di {dir} kurang dari 1 GB.', hi: 'स्वचालित बैकअप छोड़ा गया: {dir} में 1 GB से कम जगह है।',
    ta: 'தானியங்கு காப்புப்பிரதி தவிர்க்கப்பட்டது: {dir} இல் 1 GB க்கும் குறைவான இடம்.',
    ru: 'Автокопия пропущена: в {dir} свободно меньше 1 ГБ.', uk: 'Автокопію пропущено: у {dir} вільно менше 1 ГБ.'
  },
  'main.auto.failed': {
    en: 'Automatic backup failed: {error}', tl: 'Pumalya ang awtomatikong backup: {error}', es: 'Falló la copia automática: {error}',
    pt: 'O backup automático falhou: {error}', fr: 'Échec de la sauvegarde automatique : {error}', it: 'Backup automatico non riuscito: {error}',
    ko: '자동 백업 실패: {error}', zh: '自动备份失败：{error}', id: 'Cadangan otomatis gagal: {error}', hi: 'स्वचालित बैकअप विफल: {error}',
    ta: 'தானியங்கு காப்புப்பிரதி தோல்வி: {error}', ru: 'Ошибка автокопии: {error}', uk: 'Помилка автокопії: {error}'
  },

  // ----- backup files -----
  'main.backup.notBackup': {
    en: 'This is not an NLPresenter backup file.', tl: 'Hindi ito backup file ng NLPresenter.', es: 'No es un archivo de copia de NLPresenter.',
    pt: 'Este não é um arquivo de backup do NLPresenter.', fr: 'Ce n’est pas un fichier de sauvegarde NLPresenter.',
    it: 'Questo non è un file di backup di NLPresenter.', ko: 'NLPresenter 백업 파일이 아닙니다.', zh: '这不是 NLPresenter 备份文件。',
    id: 'Ini bukan file cadangan NLPresenter.', hi: 'यह NLPresenter बैकअप फ़ाइल नहीं है।', ta: 'இது NLPresenter காப்புப்பிரதி கோப்பு அல்ல.',
    ru: 'Это не файл копии NLPresenter.', uk: 'Це не файл копії NLPresenter.'
  },
  'main.backup.tooLarge': {
    en: 'Backup header is too large.', tl: 'Masyadong malaki ang header ng backup.', es: 'El encabezado de la copia es demasiado grande.',
    pt: 'O cabeçalho do backup é grande demais.', fr: 'L’en-tête de la sauvegarde est trop volumineux.', it: 'L’intestazione del backup è troppo grande.',
    ko: '백업 헤더가 너무 큽니다.', zh: '备份文件头过大。', id: 'Header cadangan terlalu besar.', hi: 'बैकअप हेडर बहुत बड़ा है।',
    ta: 'காப்புப்பிரதி தலைப்பு மிகப் பெரியது.', ru: 'Заголовок копии слишком большой.', uk: 'Заголовок копії завеликий.'
  },
  'main.backup.incomplete': {
    en: 'The backup file is incomplete (media data cut off).', tl: 'Kulang ang backup file (naputol ang media).',
    es: 'La copia está incompleta (faltan datos multimedia).', pt: 'O backup está incompleto (dados de mídia cortados).',
    fr: 'La sauvegarde est incomplète (médias tronqués).', it: 'Il backup è incompleto (dati multimediali troncati).',
    ko: '백업 파일이 불완전합니다 (미디어 데이터 잘림).', zh: '备份文件不完整（媒体数据被截断）。', id: 'File cadangan tidak lengkap (data media terpotong).',
    hi: 'बैकअप फ़ाइल अधूरी है (मीडिया डेटा कटा हुआ)।', ta: 'காப்புப்பிரதி முழுமையில்லை (மீடியா தரவு துண்டிக்கப்பட்டது).',
    ru: 'Копия неполная (медиаданные обрезаны).', uk: 'Копія неповна (медіадані обрізано).'
  },
  'main.backup.damaged': {
    en: 'The backup file is damaged.', tl: 'Sira ang backup file.', es: 'La copia está dañada.', pt: 'O arquivo de backup está danificado.',
    fr: 'La sauvegarde est endommagée.', it: 'Il file di backup è danneggiato.', ko: '백업 파일이 손상되었습니다.', zh: '备份文件已损坏。',
    id: 'File cadangan rusak.', hi: 'बैकअप फ़ाइल खराब है।', ta: 'காப்புப்பிரதி கோப்பு சேதமடைந்துள்ளது.', ru: 'Файл копии повреждён.',
    uk: 'Файл копії пошкоджено.'
  },

  // ----- presentations (PowerPoint / Keynote conversion) -----
  'main.convert.noConverterMac': {
    en: 'To import PowerPoint or Keynote files, install Keynote (free from the App Store) or LibreOffice (free). Or save the presentation as PDF and import that.',
    tl: 'Para mag-import ng PowerPoint o Keynote, i-install ang Keynote (libre sa App Store) o LibreOffice (libre). O i-save ang presentation bilang PDF at iyon ang i-import.',
    es: 'Para importar archivos de PowerPoint o Keynote, instale Keynote (gratis en el App Store) o LibreOffice (gratis). O guarde la presentación como PDF e importe ese archivo.',
    pt: 'Para importar arquivos do PowerPoint ou Keynote, instale o Keynote (grátis na App Store) ou o LibreOffice (grátis). Ou salve a apresentação como PDF e importe-o.',
    fr: 'Pour importer des fichiers PowerPoint ou Keynote, installez Keynote (gratuit sur l’App Store) ou LibreOffice (gratuit). Ou enregistrez la présentation en PDF et importez-la.',
    it: 'Per importare file PowerPoint o Keynote, installa Keynote (gratis su App Store) o LibreOffice (gratis). Oppure salva la presentazione in PDF e importala.',
    ko: 'PowerPoint나 Keynote 파일을 가져오려면 Keynote(App Store 무료) 또는 LibreOffice(무료)를 설치하세요. 또는 PDF로 저장해서 가져오세요.',
    zh: '要导入 PowerPoint 或 Keynote 文件，请安装 Keynote（App Store 免费）或 LibreOffice（免费）。也可以把演示文稿另存为 PDF 再导入。',
    id: 'Untuk mengimpor file PowerPoint atau Keynote, pasang Keynote (gratis di App Store) atau LibreOffice (gratis). Atau simpan presentasi sebagai PDF lalu impor.',
    hi: 'PowerPoint या Keynote फ़ाइलें आयात करने के लिए Keynote (App Store पर मुफ़्त) या LibreOffice (मुफ़्त) इंस्टॉल करें। या प्रेज़ेंटेशन को PDF में सहेजकर आयात करें।',
    ta: 'PowerPoint அல்லது Keynote கோப்புகளை இறக்க Keynote (App Store இல் இலவசம்) அல்லது LibreOffice (இலவசம்) நிறுவவும். அல்லது PDF ஆகச் சேமித்து அதை இறக்கவும்.',
    ru: 'Чтобы импортировать PowerPoint или Keynote, установите Keynote (бесплатно в App Store) или LibreOffice (бесплатно). Или сохраните презентацию в PDF и импортируйте его.',
    uk: 'Щоб імпортувати PowerPoint або Keynote, установіть Keynote (безкоштовно в App Store) або LibreOffice (безкоштовно). Або збережіть презентацію в PDF та імпортуйте його.'
  },
  'main.convert.noConverterWin': {
    en: 'To import PowerPoint files, install PowerPoint or LibreOffice (free). Or save the presentation as PDF and import that.',
    tl: 'Para mag-import ng PowerPoint, i-install ang PowerPoint o LibreOffice (libre). O i-save ang presentation bilang PDF at iyon ang i-import.',
    es: 'Para importar archivos de PowerPoint, instale PowerPoint o LibreOffice (gratis). O guarde la presentación como PDF e importe ese archivo.',
    pt: 'Para importar arquivos do PowerPoint, instale o PowerPoint ou o LibreOffice (grátis). Ou salve a apresentação como PDF e importe-o.',
    fr: 'Pour importer des fichiers PowerPoint, installez PowerPoint ou LibreOffice (gratuit). Ou enregistrez la présentation en PDF et importez-la.',
    it: 'Per importare file PowerPoint, installa PowerPoint o LibreOffice (gratis). Oppure salva la presentazione in PDF e importala.',
    ko: 'PowerPoint 파일을 가져오려면 PowerPoint 또는 LibreOffice(무료)를 설치하세요. 또는 PDF로 저장해서 가져오세요.',
    zh: '要导入 PowerPoint 文件，请安装 PowerPoint 或 LibreOffice（免费）。也可以把演示文稿另存为 PDF 再导入。',
    id: 'Untuk mengimpor file PowerPoint, pasang PowerPoint atau LibreOffice (gratis). Atau simpan presentasi sebagai PDF lalu impor.',
    hi: 'PowerPoint फ़ाइलें आयात करने के लिए PowerPoint या LibreOffice (मुफ़्त) इंस्टॉल करें। या प्रेज़ेंटेशन को PDF में सहेजकर आयात करें।',
    ta: 'PowerPoint கோப்புகளை இறக்க PowerPoint அல்லது LibreOffice (இலவசம்) நிறுவவும். அல்லது PDF ஆகச் சேமித்து அதை இறக்கவும்.',
    ru: 'Чтобы импортировать PowerPoint, установите PowerPoint или LibreOffice (бесплатно). Или сохраните презентацию в PDF и импортируйте его.',
    uk: 'Щоб імпортувати PowerPoint, установіть PowerPoint або LibreOffice (безкоштовно). Або збережіть презентацію в PDF та імпортуйте його.'
  },
  'main.convert.failed': {
    en: 'Could not convert {file}. {errors}', tl: 'Hindi ma-convert ang {file}. {errors}', es: 'No se pudo convertir {file}. {errors}',
    pt: 'Não foi possível converter {file}. {errors}', fr: 'Impossible de convertir {file}. {errors}', it: 'Impossibile convertire {file}. {errors}',
    ko: '{file}을(를) 변환하지 못했습니다. {errors}', zh: '无法转换 {file}。{errors}', id: 'Tidak dapat mengonversi {file}. {errors}',
    hi: '{file} को बदला नहीं जा सका। {errors}', ta: '{file} ஐ மாற்ற முடியவில்லை. {errors}', ru: 'Не удалось преобразовать {file}. {errors}',
    uk: 'Не вдалося перетворити {file}. {errors}'
  },
  'main.convert.keynoteSetup': {
    en: 'Keynote did not open the file. Open Keynote once to finish its setup, then try again.',
    tl: 'Hindi nabuksan ng Keynote ang file. Buksan muna ang Keynote para matapos ang setup, saka subukan ulit.',
    es: 'Keynote no abrió el archivo. Abra Keynote una vez para terminar su configuración y vuelva a intentarlo.',
    pt: 'O Keynote não abriu o arquivo. Abra o Keynote uma vez para concluir a configuração e tente de novo.',
    fr: 'Keynote n’a pas ouvert le fichier. Ouvrez Keynote une fois pour finir sa configuration, puis réessayez.',
    it: 'Keynote non ha aperto il file. Apri Keynote una volta per completarne la configurazione, poi riprova.',
    ko: 'Keynote가 파일을 열지 못했습니다. Keynote를 한 번 실행해 설정을 마친 뒤 다시 시도하세요.',
    zh: 'Keynote 未能打开文件。请先打开一次 Keynote 完成设置，然后重试。',
    id: 'Keynote tidak membuka file. Buka Keynote sekali untuk menyelesaikan penyiapannya, lalu coba lagi.',
    hi: 'Keynote फ़ाइल नहीं खोल सका। सेटअप पूरा करने के लिए Keynote एक बार खोलें, फिर दोबारा कोशिश करें।',
    ta: 'Keynote கோப்பைத் திறக்கவில்லை. அமைப்பை முடிக்க Keynote-ஐ ஒருமுறை திறந்து, மீண்டும் முயலவும்.',
    ru: 'Keynote не открыл файл. Откройте Keynote один раз, чтобы завершить настройку, и попробуйте снова.',
    uk: 'Keynote не відкрив файл. Відкрийте Keynote один раз, щоб завершити налаштування, і спробуйте знову.'
  },
  'main.convert.noPdf': {
    en: '{app}: no PDF was produced', tl: '{app}: walang nagawang PDF', es: '{app}: no se generó ningún PDF', pt: '{app}: nenhum PDF foi gerado',
    fr: '{app} : aucun PDF produit', it: '{app}: nessun PDF generato', ko: '{app}: PDF가 만들어지지 않음', zh: '{app}：未生成 PDF',
    id: '{app}: PDF tidak dibuat', hi: '{app}: कोई PDF नहीं बना', ta: '{app}: PDF உருவாகவில்லை', ru: '{app}: PDF не создан', uk: '{app}: PDF не створено'
  },
  'main.deck.noPages': {
    en: 'The presentation has no pages.', tl: 'Walang pahina ang presentation.', es: 'La presentación no tiene páginas.',
    pt: 'A apresentação não tem páginas.', fr: 'La présentation n’a aucune page.', it: 'La presentazione non ha pagine.',
    ko: '프레젠테이션에 페이지가 없습니다.', zh: '演示文稿没有页面。', id: 'Presentasi tidak memiliki halaman.', hi: 'प्रेज़ेंटेशन में कोई पेज नहीं है।',
    ta: 'விளக்கக்காட்சியில் பக்கங்கள் இல்லை.', ru: 'В презентации нет страниц.', uk: 'У презентації немає сторінок.'
  },

  // ----- Bible files and the translation library -----
  'main.bible.badFormat': {
    en: 'The translation list has an unexpected format.', tl: 'Hindi inaasahan ang format ng listahan ng salin.',
    es: 'La lista de traducciones tiene un formato inesperado.', pt: 'A lista de traduções tem um formato inesperado.',
    fr: 'La liste des traductions a un format inattendu.', it: 'L’elenco delle traduzioni ha un formato inatteso.',
    ko: '번역본 목록 형식이 올바르지 않습니다.', zh: '译本列表格式异常。', id: 'Format daftar terjemahan tidak sesuai.',
    hi: 'अनुवाद सूची का प्रारूप अनपेक्षित है।', ta: 'மொழிபெயர்ப்பு பட்டியலின் வடிவம் எதிர்பாராதது.', ru: 'Список переводов в неожиданном формате.',
    uk: 'Список перекладів у неочікуваному форматі.'
  },
  'main.bible.noList': {
    en: 'Could not load the translation list. Check the internet connection and try again.',
    tl: 'Hindi ma-load ang listahan ng salin. Tingnan ang internet at subukan ulit.',
    es: 'No se pudo cargar la lista de traducciones. Revise la conexión a internet e inténtelo de nuevo.',
    pt: 'Não foi possível carregar a lista de traduções. Verifique a internet e tente de novo.',
    fr: 'Impossible de charger la liste des traductions. Vérifiez la connexion internet et réessayez.',
    it: 'Impossibile caricare l’elenco delle traduzioni. Controlla la connessione e riprova.',
    ko: '번역본 목록을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.', zh: '无法加载译本列表。请检查网络连接后重试。',
    id: 'Tidak dapat memuat daftar terjemahan. Periksa koneksi internet lalu coba lagi.',
    hi: 'अनुवाद सूची लोड नहीं हो सकी। इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।',
    ta: 'மொழிபெயர்ப்பு பட்டியலை ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.',
    ru: 'Не удалось загрузить список переводов. Проверьте интернет и попробуйте снова.',
    uk: 'Не вдалося завантажити список перекладів. Перевірте інтернет і спробуйте знову.'
  },
  'main.bible.unavailable': {
    en: 'This translation is not available for download right now.', tl: 'Hindi pa ma-download ang salin na ito ngayon.',
    es: 'Esta traducción no se puede descargar ahora.', pt: 'Esta tradução não está disponível para download agora.',
    fr: 'Cette traduction n’est pas téléchargeable pour le moment.', it: 'Questa traduzione non è scaricabile al momento.',
    ko: '지금은 이 번역본을 내려받을 수 없습니다.', zh: '此译本目前无法下载。', id: 'Terjemahan ini belum bisa diunduh sekarang.',
    hi: 'यह अनुवाद अभी डाउनलोड के लिए उपलब्ध नहीं है।', ta: 'இந்த மொழிபெயர்ப்பை இப்போது பதிவிறக்க முடியாது.',
    ru: 'Этот перевод сейчас недоступен для загрузки.', uk: 'Цей переклад зараз недоступний для завантаження.'
  },
  'main.bible.downloadFailed': {
    en: 'Download failed (HTTP {status}).', tl: 'Pumalya ang download (HTTP {status}).', es: 'Falló la descarga (HTTP {status}).',
    pt: 'O download falhou (HTTP {status}).', fr: 'Échec du téléchargement (HTTP {status}).', it: 'Download non riuscito (HTTP {status}).',
    ko: '다운로드 실패 (HTTP {status}).', zh: '下载失败（HTTP {status}）。', id: 'Unduhan gagal (HTTP {status}).', hi: 'डाउनलोड विफल (HTTP {status})।',
    ta: 'பதிவிறக்கம் தோல்வி (HTTP {status}).', ru: 'Ошибка загрузки (HTTP {status}).', uk: 'Помилка завантаження (HTTP {status}).'
  },
  'main.bible.notInLibrary': {
    en: 'This translation is not in the library.', tl: 'Wala sa library ang salin na ito.', es: 'Esta traducción no está en la biblioteca.',
    pt: 'Esta tradução não está na biblioteca.', fr: 'Cette traduction n’est pas dans la bibliothèque.', it: 'Questa traduzione non è nella libreria.',
    ko: '라이브러리에 없는 번역본입니다.', zh: '库中没有此译本。', id: 'Terjemahan ini tidak ada di pustaka.', hi: 'यह अनुवाद लाइब्रेरी में नहीं है।',
    ta: 'இந்த மொழிபெயர்ப்பு நூலகத்தில் இல்லை.', ru: 'Этого перевода нет в библиотеке.', uk: 'Цього перекладу немає в бібліотеці.'
  },
  'main.bible.noText': {
    en: 'The download did not contain the Bible text.', tl: 'Walang teksto ng Bibliya sa na-download.', es: 'La descarga no contenía el texto bíblico.',
    pt: 'O download não continha o texto bíblico.', fr: 'Le téléchargement ne contenait pas le texte biblique.',
    it: 'Il download non conteneva il testo biblico.', ko: '내려받은 파일에 성경 본문이 없습니다.', zh: '下载内容中没有圣经经文。',
    id: 'Unduhan tidak berisi teks Alkitab.', hi: 'डाउनलोड में बाइबल का पाठ नहीं था।', ta: 'பதிவிறக்கத்தில் வேதாகம உரை இல்லை.',
    ru: 'В загрузке нет текста Библии.', uk: 'У завантаженні немає тексту Біблії.'
  },
  'main.bible.noVerses': {
    en: 'The download did not contain any verses.', tl: 'Walang talata sa na-download.', es: 'La descarga no contenía versículos.',
    pt: 'O download não continha versículos.', fr: 'Le téléchargement ne contenait aucun verset.', it: 'Il download non conteneva versetti.',
    ko: '내려받은 파일에 구절이 없습니다.', zh: '下载内容中没有任何经节。', id: 'Unduhan tidak berisi ayat apa pun.', hi: 'डाउनलोड में कोई पद नहीं था।',
    ta: 'பதிவிறக்கத்தில் வசனங்கள் இல்லை.', ru: 'В загрузке нет стихов.', uk: 'У завантаженні немає віршів.'
  },
  'main.xml.notZefania': {
    en: 'Not a Zefania XML Bible (no <XMLBIBLE> element).', tl: 'Hindi ito Zefania XML Bible (walang <XMLBIBLE>).',
    es: 'No es una Biblia Zefania XML (falta <XMLBIBLE>).', pt: 'Não é uma Bíblia Zefania XML (sem <XMLBIBLE>).',
    fr: 'Ce n’est pas une Bible Zefania XML (pas d’élément <XMLBIBLE>).', it: 'Non è una Bibbia Zefania XML (manca <XMLBIBLE>).',
    ko: 'Zefania XML 성경이 아닙니다 (<XMLBIBLE> 없음).', zh: '不是 Zefania XML 圣经（缺少 <XMLBIBLE>）。', id: 'Bukan Alkitab Zefania XML (tidak ada <XMLBIBLE>).',
    hi: 'यह Zefania XML बाइबल नहीं है (<XMLBIBLE> नहीं मिला)।', ta: 'இது Zefania XML வேதாகமம் அல்ல (<XMLBIBLE> இல்லை).',
    ru: 'Это не Библия Zefania XML (нет <XMLBIBLE>).', uk: 'Це не Біблія Zefania XML (немає <XMLBIBLE>).'
  },
  'main.xml.noVerses': {
    en: 'No verses found in this file.', tl: 'Walang talatang nakita sa file na ito.', es: 'No se encontraron versículos en este archivo.',
    pt: 'Nenhum versículo encontrado neste arquivo.', fr: 'Aucun verset trouvé dans ce fichier.', it: 'Nessun versetto trovato in questo file.',
    ko: '이 파일에서 구절을 찾지 못했습니다.', zh: '此文件中没有找到经节。', id: 'Tidak ada ayat di file ini.', hi: 'इस फ़ाइल में कोई पद नहीं मिला।',
    ta: 'இந்தக் கோப்பில் வசனங்கள் இல்லை.', ru: 'В файле не найдено стихов.', uk: 'У файлі не знайдено віршів.'
  },
  'main.xml.unsupported': {
    en: 'Not a supported Bible XML file.', tl: 'Hindi suportadong Bible XML file.', es: 'No es un archivo XML de Biblia compatible.',
    pt: 'Não é um arquivo XML de Bíblia compatível.', fr: 'Fichier XML de Bible non pris en charge.', it: 'File XML della Bibbia non supportato.',
    ko: '지원하지 않는 성경 XML 파일입니다.', zh: '不支持的圣经 XML 文件。', id: 'File XML Alkitab tidak didukung.', hi: 'यह समर्थित बाइबल XML फ़ाइल नहीं है।',
    ta: 'ஆதரிக்கப்படாத வேதாகம XML கோப்பு.', ru: 'Неподдерживаемый XML-файл Библии.', uk: 'Непідтримуваний XML-файл Біблії.'
  }
} satisfies AreaStrings
