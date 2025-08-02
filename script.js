class TableTennisRecordSystem {
    constructor() {
        this.matches = JSON.parse(localStorage.getItem('matches') || '[]');
        this.players = JSON.parse(localStorage.getItem('players') || '[]');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStats();
        this.displayHistory();
        this.displayPlayerStats();
        
        // 設定今天的日期
        document.getElementById('match-date').value = new Date().toISOString().split('T')[0];
    }

    setupEventListeners() {
        // 表單提交
        document.getElementById('match-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addMatch();
        });

        // 自動計算比賽結果
        const scoreInputs = document.querySelectorAll('.our-score, .opp-score');
        scoreInputs.forEach(input => {
            input.addEventListener('input', () => this.calculateResult());
        });

        // 球員選單切換
        document.getElementById('our-player').addEventListener('change', (e) => {
            const customInput = document.getElementById('our-player-custom');
            if (e.target.value === 'other') {
                customInput.style.display = 'block';
                customInput.required = true;
            } else {
                customInput.style.display = 'none';
                customInput.required = false;
                customInput.value = '';
            }
        });
    }

    // 分頁切換
    showTab(tabName) {
        // 隱藏所有分頁
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 移除所有按鈕的active狀態
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 顯示選中的分頁
        document.getElementById(tabName + '-tab').classList.add('active');
        
        // 設定對應按鈕為active
        event.target.classList.add('active');
        
        // 更新資料
        if (tabName === 'stats') {
            this.updateStats();
            this.displayPlayerStats();
        } else if (tabName === 'history') {
            this.displayHistory();
        }
    }

    // 自動計算比賽結果
    calculateResult() {
        const sets = document.querySelectorAll('.set');
        let ourWins = 0;
        let oppWins = 0;

        sets.forEach(set => {
            const ourScore = parseInt(set.querySelector('.our-score').value) || 0;
            const oppScore = parseInt(set.querySelector('.opp-score').value) || 0;
            
            if (ourScore > 0 || oppScore > 0) {
                if (ourScore > oppScore) {
                    ourWins++;
                } else if (oppScore > ourScore) {
                    oppWins++;
                }
            }
        });

        const resultSelect = document.getElementById('result');
        if (ourWins > oppWins && (ourWins >= 3 || ourWins >= 2)) {
            resultSelect.value = 'win';
        } else if (oppWins > ourWins && (oppWins >= 3 || oppWins >= 2)) {
            resultSelect.value = 'lose';
        } else {
            resultSelect.value = '';
        }
    }

    // 新增比賽記錄
    addMatch() {
        const formData = new FormData(document.getElementById('match-form'));
        
        // 收集比分資料
        const scores = [];
        const sets = document.querySelectorAll('.set');
        sets.forEach(set => {
            const ourScore = set.querySelector('.our-score').value;
            const oppScore = set.querySelector('.opp-score').value;
            if (ourScore || oppScore) {
                scores.push({
                    our: parseInt(ourScore) || 0,
                    opponent: parseInt(oppScore) || 0
                });
            }
        });

        // 取得球員名稱
        const playerSelect = document.getElementById('our-player');
        const customInput = document.getElementById('our-player-custom');
        const ourPlayer = playerSelect.value === 'other' ? customInput.value : playerSelect.value;

        const match = {
            id: Date.now(),
            date: document.getElementById('match-date').value,
            opponent: document.getElementById('opponent').value,
            matchType: document.getElementById('match-type').value,
            ourPlayer: ourPlayer,
            opponentPlayer: document.getElementById('opponent-player').value,
            scores: scores,
            result: document.getElementById('result').value,
            notes: document.getElementById('notes').value,
            timestamp: new Date().toISOString()
        };

        this.matches.push(match);
        this.updatePlayerRecord(match.ourPlayer, match.result);
        this.saveData();
        this.showSuccessMessage('比賽記錄已儲存！');
        this.resetForm();
        this.updateStats();
        this.displayHistory();
        this.displayPlayerStats();
    }

    // 更新球員記錄
    updatePlayerRecord(playerName, result) {
        let player = this.players.find(p => p.name === playerName);
        if (!player) {
            player = {
                name: playerName,
                matches: 0,
                wins: 0,
                losses: 0
            };
            this.players.push(player);
        }
        
        player.matches++;
        if (result === 'win') {
            player.wins++;
        } else {
            player.losses++;
        }
    }

    // 儲存資料到本地
    saveData() {
        localStorage.setItem('matches', JSON.stringify(this.matches));
        localStorage.setItem('players', JSON.stringify(this.players));
    }

    // 重置表單
    resetForm() {
        document.getElementById('match-form').reset();
        document.getElementById('match-date').value = new Date().toISOString().split('T')[0];
        
        // 重置球員選單
        document.getElementById('our-player-custom').style.display = 'none';
        document.getElementById('our-player-custom').required = false;
    }

    // 顯示成功訊息
    showSuccessMessage(message) {
        // 創建提示元素
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // 3秒後自動移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // 更新統計資料
    updateStats() {
        const totalMatches = this.matches.length;
        const wins = this.matches.filter(m => m.result === 'win').length;
        const winRate = totalMatches > 0 ? (wins / totalMatches * 100).toFixed(1) : 0;

        document.getElementById('total-matches').textContent = totalMatches;
        document.getElementById('wins').textContent = wins;
        document.getElementById('win-rate').textContent = winRate + '%';
    }

    // 顯示球員統計
    displayPlayerStats() {
        const playerList = document.getElementById('player-list');
        playerList.innerHTML = '';

        if (this.players.length === 0) {
            playerList.innerHTML = '<p>尚無球員記錄</p>';
            return;
        }

        this.players.forEach(player => {
            const winRate = player.matches > 0 ? (player.wins / player.matches * 100).toFixed(1) : 0;
            
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-record">
                    總場次: ${player.matches} | 
                    勝: ${player.wins} | 
                    負: ${player.losses} | 
                    勝率: ${winRate}%
                </div>
            `;
            
            playerList.appendChild(playerElement);
        });
    }

    // 顯示歷史記錄
    displayHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        if (this.matches.length === 0) {
            historyList.innerHTML = '<p>尚無比賽記錄</p>';
            return;
        }

        // 按日期排序（最新的在前）
        const sortedMatches = [...this.matches].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedMatches.forEach(match => {
            const matchElement = document.createElement('div');
            matchElement.className = `history-item ${match.result}`;
            
            // 格式化比分
            const scoresText = match.scores.map(score => `${score.our}:${score.opponent}`).join(' ');
            
            matchElement.innerHTML = `
                <div class="match-header">
                    <div>
                        <strong>${match.ourPlayer}</strong> vs <strong>${match.opponentPlayer}</strong>
                        <br>
                        <small>對手學校: ${match.opponent}</small>
                    </div>
                    <div>
                        <div class="match-date">${this.formatDate(match.date)}</div>
                        <div class="match-result ${match.result}">
                            ${match.result === 'win' ? '勝' : '負'}
                        </div>
                    </div>
                </div>
                <div class="match-details">
                    <div>比賽類型: ${this.getMatchTypeText(match.matchType)}</div>
                    ${scoresText ? `<div class="match-score">比分: ${scoresText}</div>` : ''}
                    ${match.notes ? `<div>備註: ${match.notes}</div>` : ''}
                </div>
            `;
            
            historyList.appendChild(matchElement);
        });
    }

    // 格式化日期
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // 取得比賽類型文字
    getMatchTypeText(type) {
        const types = {
            'team': '團體賽',
            'singles': '個人單打',
            'doubles': '個人雙打'
        };
        return types[type] || type;
    }
}

// 全域函數（供HTML呼叫）
function showTab(tabName) {
    system.showTab(tabName);
}

// 初始化系統
const system = new TableTennisRecordSystem();

// 新增CSS動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);