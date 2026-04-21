export class AudioManager {
    constructor() {
        this.audio = new Audio();

        this.playlist = [
            { title: 'Love You To Death', file: 'public/audio/Type_O_Negative_-_Love_You_To_Death.mp3' },
            { title: 'Be My Druidess', file: 'public/audio/Type_O_Negative_-_Be_My_Druidess.mp3' },
            { title: 'Green Man', file: 'public/audio/Type_O_Negative_-_Green_Man.mp3' },
            { title: 'Red Water', file: 'public/audio/Type_O_Negative_-_Red_Water.mp3' },
            { title: 'My Girlfriend\'s Girlfriend', file: 'public/audio/Type_O_Negative_-_My_Girlfriends_Girlfriend.mp3' },
            { title: 'Die With Me', file: 'public/audio/Type_O_Negative_-_Die_With_Me.mp3' },
            { title: 'Burnt Flowers Fallen', file: 'public/audio/Type_O_Negative_-_Burnt_Flowers_Fallen.mp3' }
        ];

        this.currentIndex = 0;
        this.isPlaying = false;

        this.audio.volume = 0.5;
        this.audio.loop = false;

        this.initUI();
        this.setupEventListeners();
        this.loadTrack(0);
    }

    initUI() {
        this.playPauseBtn = document.getElementById('play-pause');
        this.nextBtn = document.getElementById('next-track');
        this.trackInfo = document.getElementById('track-info');
        this.volumeSlider = document.getElementById('volume-slider');
    }

    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.nextBtn.addEventListener('click', () => this.nextTrack());
        this.volumeSlider.addEventListener('input', (e) => {
            this.audio.volume = e.target.value;
        });

        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸️';
        });
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️';
        });
        this.audio.addEventListener('error', (e) => {
            console.error('Ошибка загрузки аудио:', e);
            this.trackInfo.textContent = '❌ Ошибка трека';
        });
    }

    loadTrack(index) {
        if (index >= this.playlist.length) index = 0;
        this.currentIndex = index;
        const track = this.playlist[index];
        this.audio.src = track.file;
        this.trackInfo.textContent = `🎵 ${track.title}`;
        if (this.isPlaying) {
            this.audio.play().catch(e => console.log('Ожидание взаимодействия'));
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch(e => {
                console.log('Автовоспроизведение заблокировано, нажмите ещё раз');
            });
        }
    }

    nextTrack() {
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        this.loadTrack(nextIndex);
        if (this.isPlaying) {
            this.audio.play().catch(e => console.log('Ожидание'));
        }
    }

    setVolume(value) {
        this.audio.volume = Math.max(0, Math.min(1, value));
        this.volumeSlider.value = this.audio.volume;
    }
}