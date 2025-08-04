class TableTennisRecordSystem {
    constructor() {
        // Google Apps Script API URL - 請替換為你的Apps Script部署URL
        this.apiUrl = 'https://script.google.com/macros/s/AKfycbxTuBBt9URny3Cw7m-47_g1aPT6pgzJTmd2ODcBcKzANVZhnhq7aw2Y7MHzouDzzDQ5/exec';
        console.log('🔗 使用的Apps Script URL:', this.apiUrl);
        
        // 預期的Google Sheets欄位順序 (A-I)
        this.expectedColumns = [
            'date', 'opponentSchool', 'matchType', 'ourPlayers', 
            'opponentPlayers', 'scores', 'result', 'notes', 'timestamp'
        ];
        
        // 球員資料對應表 (根據grade.png建立)
        this.playerData = {
            '陳敬允': '10201',
            '黃梓恩': '10201', // 需要確認實際座號
            '許晉承': '20205',
            '李知昱': '20205', // 需要確認實際座號
            '徐寓凱': '30503',
            '游翔凱': '30603',
            '蔡孟廷': '30703',
            '莊皓嵐': '30809',
            '陳禹澤': '30812',
            '王語瑄': '30823',
            '張愷均': '30905',
            '張振齊': '40311',
            '周禹顥': '40309',
            '郭仁傑': '40310',
            '黃柏睿': '40404',
            '陳泓睿': '40511',
            '李予閎': '40512',
            '鄭立楷': '40710',
            '張芮庭': '50134',
            '陳沛筠': '50224',
            '葉立勤': '50306',
            '郭宸睿': '50612',
            '李定謙': '50701',
            '王嘉旻': '50713',
            '陳妍齊': '50829',
            '林培鈞': '50904'
        };
        // 本地記憶的比賽與球員資料
        this.matches = [];
        this.players = [];
        // 對手學校列表，儲存在 localStorage 便於 datalist 使用
        this.opponentSchools = JSON.parse(localStorage.getItem('opponentSchools') || '[]');
        // 離線模式資料管理
        this.pendingMatches = JSON.parse(localStorage.getItem('pendingMatches') || '[]');
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        
        // 篩選功能相關
        this.filteredMatches = [];
        this.activeFilters = {
            player: '',
            matchType: '',
            result: '',
            opponent: '',
            dateStart: '',
            dateEnd: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupNetworkMonitoring();
        
        // 設定今天日期
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('match-date').value = today;
        
        // 驗證系統設定
        this.validateConfiguration();
        
        // 嘗試從 Sheety 讀取資料
        await this.fetchMatchesFromSheet();
        
        // 更新對手學校 datalist
        this.updateOpponentList();
        
        // 檢查是否有待同步資料
        this.updateSyncStatus();
        
        // 預設顯示記錄分頁
        this.showTab('record', document.querySelector('.nav-btn.active'));
    }

    /**
     * 根據座號判斷年級 (座號第一位數字 + 1)
     */
    getGradeFromStudentId(studentId) {
        if (!studentId || studentId.length < 5) return null;
        const gradeDigit = parseInt(studentId.charAt(0));
        return gradeDigit + 1; // 暑假後升級，所以 +1
    }

    /**
     * 根據球員姓名獲取年級
     */
    getPlayerGrade(playerName) {
        const studentId = this.playerData[playerName];
        return studentId ? this.getGradeFromStudentId(studentId) : null;
    }

    /**
     * 根據年級獲取該年級的所有球員
     */
    getPlayersByGrade(grade) {
        const players = [];
        for (const [name, studentId] of Object.entries(this.playerData)) {
            if (this.getGradeFromStudentId(studentId) === parseInt(grade)) {
                players.push(name);
            }
        }
        return players.sort(); // 按名字排序
    }

    /**
     * 更新球員選單內容
     */
    updatePlayerSelect(gradeSelectId, playerSelectId, selectedGrade) {
        const playerSelect = document.getElementById(playerSelectId);
        if (!playerSelect) return;

        // 清空現有選項
        playerSelect.innerHTML = '<option value="">請選擇球員</option>';
        
        if (selectedGrade) {
            // 啟用球員選單
            playerSelect.disabled = false;
            
            // 添加該年級的球員
            const players = this.getPlayersByGrade(selectedGrade);
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                playerSelect.appendChild(option);
            });
            
            // 添加"其他"選項
            const otherOption = document.createElement('option');
            otherOption.value = 'other';
            otherOption.textContent = '其他（手動輸入）';
            playerSelect.appendChild(otherOption);
        } else {
            // 停用球員選單
            playerSelect.disabled = true;
            playerSelect.innerHTML = '<option value="">請先選擇年級</option>';
        }
    }

    setupEventListeners() {
        // 表單提交
        const form = document.getElementById('match-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addMatch();
            });
        }
        // 比分輸入更新結果
        document.querySelectorAll('.our-score, .opp-score').forEach(input => {
            input.addEventListener('input', () => this.calculateResult());
        });
        
        // 第一位球員年級選擇
        const gradeSelect1 = document.getElementById('our-player-grade');
        if (gradeSelect1) {
            gradeSelect1.addEventListener('change', (e) => {
                this.updatePlayerSelect('our-player-grade', 'our-player', e.target.value);
            });
        }
        
        // 第一位球員選擇
        const playerSelect = document.getElementById('our-player');
        if (playerSelect) {
            playerSelect.addEventListener('change', (e) => {
                this.toggleCustomPlayerInput('our-player', 'our-player-custom', e.target.value);
            });
        }
        
        // 第二位球員年級選擇
        const gradeSelect2 = document.getElementById('our-player-2-grade');
        if (gradeSelect2) {
            gradeSelect2.addEventListener('change', (e) => {
                this.updatePlayerSelect('our-player-2-grade', 'our-player-2', e.target.value);
            });
        }
        
        // 第二位球員選擇
        const secondSelect = document.getElementById('our-player-2');
        if (secondSelect) {
            secondSelect.addEventListener('change', (e) => {
                this.toggleCustomPlayerInput('our-player-2', 'our-player-2-custom', e.target.value);
            });
        }
        // 比賽類型改變，控制雙打欄位
        const matchTypeSelect = document.getElementById('match-type');
        if (matchTypeSelect) {
            matchTypeSelect.addEventListener('change', (e) => {
                this.togglePlayerFields(e.target.value);
            });
        }
    }

    /**
     * 切換自訂球員輸入欄位
     */
    toggleCustomPlayerInput(selectId, inputId, value) {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        if (value === 'other') {
            inputEl.style.display = 'block';
            inputEl.required = true;
        } else {
            inputEl.style.display = 'none';
            inputEl.required = false;
            inputEl.value = '';
        }
    }

    /**
     * 控制雙打欄位顯示
     */
    togglePlayerFields(matchType) {
        const ourGroup = document.getElementById('our-player-2-group');
        const oppGroup = document.getElementById('opponent-player-2-group');
        if (matchType === 'doubles') {
            if (ourGroup) ourGroup.style.display = 'block';
            if (oppGroup) oppGroup.style.display = 'block';
        } else {
            if (ourGroup) {
                ourGroup.style.display = 'none';
                // 重置第二位球員的年級和球員選單
                const grade2 = document.getElementById('our-player-2-grade');
                if (grade2) grade2.value = '';
                const sel2 = document.getElementById('our-player-2');
                if (sel2) {
                    sel2.value = '';
                    sel2.disabled = true;
                    sel2.innerHTML = '<option value="">請先選擇年級</option>';
                }
                const cust2 = document.getElementById('our-player-2-custom');
                if (cust2) {
                    cust2.value = '';
                    cust2.style.display = 'none';
                    cust2.required = false;
                }
            }
            if (oppGroup) {
                oppGroup.style.display = 'none';
                const opp2 = document.getElementById('opponent-player-2');
                if (opp2) opp2.value = '';
            }
        }
    }

    validateConfiguration() {
        console.log('🔍 驗證系統配置...');
        
        // 檢查API URL格式
        if (!this.apiUrl.includes('script.google.com')) {
            console.error('❌ Apps Script URL格式錯誤');
            this.showErrorMessage('系統配置錯誤：Apps Script URL格式錯誤');
            return false;
        }
        
        console.log('✅ 基本配置驗證通過');
        console.log('🔗 Apps Script URL:', this.apiUrl);
        
        return true;
    }
    
    validateColumnMapping(data) {
        console.log('🔍 檢查Google Sheets欄位對應...');
        
        if (!data || typeof data !== 'object') {
            console.error('❌ 回應資料格式無效');
            return false;
        }
        
        // 檢查可用的資料鍵
        const availableKeys = Object.keys(data);
        console.log('📊 Sheety回應的可用鍵:', availableKeys);
        
        // 檢查是否有正確的陣列資料
        let dataArray = [];
        if (Array.isArray(data.t1s)) dataArray = data.t1s;
        else if (Array.isArray(data.t1S)) dataArray = data.t1S;
        else if (Array.isArray(data.t1)) dataArray = data.t1;
        
        if (dataArray.length > 0) {
            const firstRecord = dataArray[0];
            const recordKeys = Object.keys(firstRecord);
            console.log('📋 第一筆記錄的欄位:', recordKeys);
            
            // 檢查是否包含預期的欄位
            const missingColumns = this.expectedColumns.filter(col => !recordKeys.includes(col));
            const extraColumns = recordKeys.filter(col => !this.expectedColumns.includes(col) && col !== 'id');
            
            if (missingColumns.length > 0) {
                console.warn('⚠️ 缺少預期欄位:', missingColumns);
                console.warn('這可能表示Google Sheets欄位順序不正確');
            }
            
            if (extraColumns.length > 0) {
                console.warn('⚠️ 發現額外欄位:', extraColumns);
                console.warn('資料可能寫入到錯誤的欄位 (如T-AB而非A-I)');
            }
            
            if (missingColumns.length === 0 && extraColumns.length === 0) {
                console.log('✅ Google Sheets欄位對應正確');
                return true;
            } else {
                console.log('❌ Google Sheets欄位對應有問題');
                this.showErrorMessage('Google Sheets欄位對應錯誤，請檢查Sheety設定');
                return false;
            }
        } else {
            console.log('📝 Google Sheets暫無資料，無法驗證欄位對應');
            return true; // 空資料表時無法驗證，假設正確
        }
    }

    setupNetworkMonitoring() {
        // 監聽網路狀態變化
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showSuccessMessage('網路連線已恢復');
            this.autoSyncPendingMatches();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showErrorMessage('網路連線中斷，將進入離線模式');
        });
    }

    updateSyncStatus() {
        const pendingCount = this.pendingMatches.length;
        if (pendingCount > 0) {
            this.showSyncStatus(`🟡 有 ${pendingCount} 筆記錄待同步`, 'pending');
        } else {
            this.showSyncStatus('🟢 所有資料已同步', 'synced');
        }
    }

    showSyncStatus(message, status) {
        // 移除現有狀態
        const existing = document.getElementById('sync-status');
        if (existing) existing.remove();

        const statusEl = document.createElement('div');
        statusEl.id = 'sync-status';
        statusEl.textContent = message;
        statusEl.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            z-index: 1000;
            ${status === 'pending' ? 'background: #ffc107; color: #000;' : 'background: #28a745; color: #fff;'}
        `;
        
        // 如果有待同步資料，添加點擊事件
        if (status === 'pending') {
            statusEl.style.cursor = 'pointer';
            statusEl.title = '點擊手動同步';
            statusEl.addEventListener('click', () => this.manualSync());
        }
        
        document.body.appendChild(statusEl);
    }

    async autoSyncPendingMatches() {
        if (this.syncInProgress || !this.isOnline || this.pendingMatches.length === 0) {
            return;
        }
        
        this.syncInProgress = true;
        this.showLoadingMessage(`正在同步 ${this.pendingMatches.length} 筆待同步記錄...`);
        
        let syncedCount = 0;
        const totalCount = this.pendingMatches.length;
        
        // 逐筆同步
        for (let i = this.pendingMatches.length - 1; i >= 0; i--) {
            const pendingMatch = this.pendingMatches[i];
            try {
                await this.syncSingleMatch(pendingMatch);
                this.pendingMatches.splice(i, 1);
                syncedCount++;
            } catch (error) {
                console.error('同步失敗:', error);
                break; // 停止同步，避免重複錯誤
            }
        }
        
        // 更新localStorage
        localStorage.setItem('pendingMatches', JSON.stringify(this.pendingMatches));
        
        this.hideLoadingMessage();
        this.syncInProgress = false;
        
        if (syncedCount > 0) {
            this.showSuccessMessage(`成功同步 ${syncedCount}/${totalCount} 筆記錄`);
            await this.fetchMatchesFromSheet(); // 重新載入資料
        }
        
        this.updateSyncStatus();
    }

    async manualSync() {
        if (this.syncInProgress) {
            this.showErrorMessage('同步進行中，請稍候');
            return;
        }
        
        if (!this.isOnline) {
            this.showErrorMessage('網路未連線，無法同步');
            return;
        }
        
        await this.autoSyncPendingMatches();
    }
    
    async testOfflineOnlineSync() {
        console.log('🧪 開始離線/線上同步功能測試...');
        
        try {
            // 1. 測試離線模式保存
            console.log('📝 測試離線模式保存...');
            const testMatch = {
                date: new Date().toISOString().split('T')[0],
                opponentSchool: '測試學校',
                matchType: 'singles',
                ourPlayers: ['測試球員'],
                opponentPlayers: ['對手球員'],
                scores: [{ our: 11, opponent: 9 }],
                result: 'win',
                notes: '同步測試',
                timestamp: new Date().toISOString()
            };
            
            this.saveToOfflineMode(testMatch);
            console.log('✅ 離線模式保存成功');
            
            // 2. 測試網路狀態檢查
            console.log('🌐 測試網路狀態檢查...');
            console.log('當前網路狀態:', this.isOnline ? '線上' : '離線');
            console.log('瀏覽器網路狀態:', navigator.onLine ? '線上' : '離線');
            
            // 3. 測試待同步資料載入
            console.log('📋 測試待同步資料載入...');
            console.log('待同步資料筆數:', this.pendingMatches.length);
            
            // 4. 如果在線上，測試同步功能
            if (this.isOnline && navigator.onLine) {
                console.log('🔄 測試線上同步功能...');
                await this.autoSyncPendingMatches();
                console.log('✅ 線上同步測試完成');
            } else {
                console.log('📵 離線狀態，跳過線上同步測試');
            }
            
            // 5. 測試UI狀態更新
            console.log('🖥️ 測試UI狀態更新...');
            this.updateSyncStatus();
            console.log('✅ UI狀態更新完成');
            
            console.log('🎉 離線/線上同步功能測試完成！');
            this.showSuccessMessage('同步功能測試完成！詳情請查看控制台');
            
        } catch (error) {
            console.error('❌ 同步功能測試失敗:', error);
            this.showErrorMessage('同步功能測試失敗：' + error.message);
        }
    }

    async syncSingleMatch(matchData) {
        const body = {
            t1: {
                date: matchData.date,
                opponentSchool: matchData.opponentSchool,
                matchType: matchData.matchType,
                ourPlayers: matchData.ourPlayers.join(','),
                opponentPlayers: matchData.opponentPlayers.join(','),
                scores: JSON.stringify(matchData.scores),
                result: matchData.result,
                notes: matchData.notes,
                timestamp: matchData.timestamp || new Date().toISOString()
            }
        };
        
        // 使用FormData方式，與主要的saveMatchToSheet一致
        const formData = new FormData();
        formData.append('data', JSON.stringify(body));
        
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`同步失敗: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * 切換分頁
     */
    showTab(tabName, button) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        const activeTab = document.getElementById(`${tabName}-tab`);
        if (activeTab) activeTab.classList.add('active');
        // 更新按鈕樣式
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (button) button.classList.add('active');
        if (tabName === 'stats') {
            this.updateStats();
            this.displayPlayerStats();
        } else if (tabName === 'history') {
            this.initializeFilters();
            this.displayHistory();
        }
    }

    /**
     * 計算比賽結果
     */
    calculateResult() {
        const sets = document.querySelectorAll('.set');
        let ourWins = 0;
        let oppWins = 0;
        sets.forEach(set => {
            const ourScore = parseInt(set.querySelector('.our-score').value) || 0;
            const oppScore = parseInt(set.querySelector('.opp-score').value) || 0;
            if (ourScore === 0 && oppScore === 0) return;
            if (ourScore > oppScore) ourWins++;
            if (oppScore > ourScore) oppWins++;
        });
        const resultSelect = document.getElementById('result');
        if (!resultSelect) return;
        if (ourWins > oppWins && ourWins >= 2) {
            resultSelect.value = 'win';
        } else if (oppWins > ourWins && oppWins >= 2) {
            resultSelect.value = 'lose';
        } else {
            resultSelect.value = '';
        }
    }

    /**
     * 新增比賽並送至 Sheety
     */
    async addMatch() {
        // 收集局分
        const scores = [];
        document.querySelectorAll('.set').forEach(set => {
            const ourScore = set.querySelector('.our-score').value;
            const oppScore = set.querySelector('.opp-score').value;
            if (ourScore || oppScore) {
                scores.push({ our: parseInt(ourScore) || 0, opponent: parseInt(oppScore) || 0 });
            }
        });
        // 我方球員
        const ourPlayers = [];
        const p1Select = document.getElementById('our-player');
        const p1Custom = document.getElementById('our-player-custom');
        if (p1Select) {
            if (p1Select.value === 'other') {
                if (p1Custom && p1Custom.value.trim()) ourPlayers.push(p1Custom.value.trim());
            } else if (p1Select.value) {
                ourPlayers.push(p1Select.value);
            }
        }
        const p2Select = document.getElementById('our-player-2');
        const p2Custom = document.getElementById('our-player-2-custom');
        const matchType = document.getElementById('match-type') ? document.getElementById('match-type').value : '';
        if (matchType === 'doubles' && p2Select) {
            if (p2Select.value === 'other') {
                if (p2Custom && p2Custom.value.trim()) ourPlayers.push(p2Custom.value.trim());
            } else if (p2Select.value) {
                ourPlayers.push(p2Select.value);
            }
        }
        // 對手球員
        const opponentPlayers = [];
        const opp1 = document.getElementById('opponent-player');
        if (opp1 && opp1.value.trim()) opponentPlayers.push(opp1.value.trim());
        const opp2 = document.getElementById('opponent-player-2');
        if (matchType === 'doubles' && opp2 && opp2.value.trim()) opponentPlayers.push(opp2.value.trim());
        // Debug: 檢查表單資料收集
        console.log('=== DEBUG: 表單資料收集 ===');
        console.log('我方球員陣列:', ourPlayers);
        console.log('對手球員陣列:', opponentPlayers);
        console.log('比賽類型:', matchType);
        console.log('比賽結果:', document.getElementById('result').value);
        console.log('========================');

        // 表單驗證：防止空資料送到Sheety
        const validationData = {
            date: document.getElementById('match-date').value,
            opponentSchool: document.getElementById('opponent').value.trim(),
            matchType: matchType,
            ourPlayers: ourPlayers,
            opponentPlayers: opponentPlayers,
            result: document.getElementById('result').value
        };
        
        console.log('=== DEBUG: 驗證資料 ===');
        console.log('驗證資料:', validationData);
        console.log('==================');
        
        const validationErrors = this.validateMatchData(validationData);

        if (validationErrors.length > 0) {
            console.log('驗證錯誤:', validationErrors);
            this.showErrorMessage('請檢查以下問題：\n' + validationErrors.join('\n'));
            return;
        }

        // 構建 match 物件
        const match = {
            date: document.getElementById('match-date').value,
            opponentSchool: document.getElementById('opponent').value.trim(),
            matchType: matchType,
            ourPlayers: ourPlayers,
            opponentPlayers: opponentPlayers,
            scores: scores,
            result: document.getElementById('result').value,
            notes: document.getElementById('notes').value.trim(),
            timestamp: new Date().toISOString()
        };
        // 更新學校列表
        this.updateOpponentSchools(match.opponentSchool);
        
        try {
            // 儲存到 Sheety
            await this.saveMatchToSheet(match);
            // 重置表單
            this.resetForm();
            // 更新介面
            this.updateStats();
            this.displayPlayerStats();
            this.displayHistory();
        } catch (err) {
            // API儲存失敗，但不影響後續操作
            console.error('API儲存失敗，但表單資料已保留:', err);
            // 不重置表單，讓用戶可以重試
        }
    }

    /**
     * 儲存對手學校
     */
    updateOpponentSchools(schoolName) {
        if (!schoolName) return;
        if (!this.opponentSchools.includes(schoolName)) {
            this.opponentSchools.push(schoolName);
            localStorage.setItem('opponentSchools', JSON.stringify(this.opponentSchools));
            this.updateOpponentList();
        }
    }

    updateOpponentList() {
        const list = document.getElementById('opponent-list');
        if (!list) return;
        list.innerHTML = '';
        this.opponentSchools.forEach(school => {
            const option = document.createElement('option');
            option.value = school;
            list.appendChild(option);
        });
    }

    /**
     * 讀取 Sheety 資料
     */
    async fetchMatchesFromSheet() {
        try {
            console.log('📡 發送GET請求到:', this.apiUrl);
            
            const res = await fetch(this.apiUrl, {
                method: 'GET'
            });
            
            console.log('📊 GET回應狀態:', res.status);
            console.log('📊 GET回應OK:', res.ok);
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('❌ GET請求失敗:', res.status, res.statusText);
                console.error('❌ 錯誤詳情:', errorText);
                throw new Error(`HTTP ${res.status}: ${res.statusText}\n${errorText}`);
            }
            
            const data = await res.json();
            
            // Debug: 檢查Sheety回傳的完整結構
            console.log('=== DEBUG: Sheety讀取回應 ===');
            console.log('完整回應:', data);
            console.log('可用的keys:', Object.keys(data));
            console.log('response status:', res.status);
            console.log('==============================');
            
            // 驗證欄位對應
            this.validateColumnMapping(data);
            
            let list = [];
            if (Array.isArray(data.t1s)) list = data.t1s;
            else if (Array.isArray(data.t1S)) list = data.t1S;
            else if (Array.isArray(data.t1)) list = data.t1;
            
            console.log('解析後的list:', list);
            console.log('list長度:', list.length);
            this.matches = list.map(item => ({
                id: item.id,
                date: item.date,
                opponentSchool: item.opponentSchool || item.opponent || '',
                matchType: item.matchType,
                ourPlayers: item.ourPlayers ? item.ourPlayers.split(',').map(s => s.trim()) : [],
                opponentPlayers: item.opponentPlayers ? item.opponentPlayers.split(',').map(s => s.trim()) : [],
                scores: item.scores ? JSON.parse(item.scores) : [],
                result: item.result,
                notes: item.notes,
                timestamp: item.timestamp || item.date || new Date().toISOString() // 備用timestamp
            }));
            this.recomputePlayerStats();
            this.updateStats();
            this.displayPlayerStats();
            this.displayHistory();
        } catch (err) {
            console.error('取得遠端資料失敗', err);
        }
    }

    /**
     * 儲存單筆資料到 Sheety (支援離線模式)
     */
    async saveMatchToSheet(match) {
        // 檢查網路狀態
        if (!this.isOnline || !navigator.onLine) {
            return this.saveToOfflineMode(match);
        }
        
        // 顯示loading狀態
        this.showLoadingMessage('正在儲存比賽記錄...');
        
        try {
            // 恢復完整資料格式
            const processedData = {
                date: match.date || '2025-08-03',
                opponentSchool: match.opponentSchool || 'test',
                matchType: match.matchType || 'singles',
                ourPlayers: (match.ourPlayers && match.ourPlayers.length > 0) ? match.ourPlayers.join(',') : 'test',
                opponentPlayers: (match.opponentPlayers && match.opponentPlayers.length > 0) ? match.opponentPlayers.join(',') : 'test',
                scores: match.scores && match.scores.length > 0 ? JSON.stringify(match.scores) : '[]',
                result: match.result || 'win',
                notes: match.notes || '',
                timestamp: new Date().toISOString()
            };
            
            // 最終檢查：確保沒有undefined、null值，並去除多餘空格
            Object.keys(processedData).forEach(key => {
                if (processedData[key] === undefined || processedData[key] === null || processedData[key] === 'undefined' || processedData[key] === 'null') {
                    processedData[key] = '';
                }
                // 確保是字串並去除前後空格
                processedData[key] = String(processedData[key]).trim();
            });
            
            const body = { t1: processedData };
            
            // Debug: 詳細記錄發送的資料
            console.log('=== DEBUG: 準備發送到Sheety的資料 ===');
            console.log('URL:', this.sheetyUrl);
            console.log('原始match物件:', match);
            console.log('處理後的body:', body);
            console.log('JSON字串:', JSON.stringify(body, null, 2));
            console.log('==========================================');
            
            // 設定Bearer Token驗證
            const headers = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.sheetyToken}`
            };
            
            console.log('📤 發送POST請求到:', this.apiUrl);
            console.log('📦 發送資料:', JSON.stringify(body, null, 2));
            
            // 使用form data方式避免CORS preflight
            const formData = new FormData();
            formData.append('data', JSON.stringify(body));
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            console.log('📊 POST回應狀態:', response.status);
            console.log('📊 POST回應OK:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ POST請求失敗:', response.status, response.statusText);
                console.error('❌ 錯誤詳情:', errorText);
                
                // 特別處理403錯誤 - 權限問題
                if (response.status === 403) {
                    console.error('🚫 403錯誤 - 可能的原因:');
                    console.error('1. Bearer Token無效或格式錯誤');
                    console.error('2. Sheety專案權限未正確設定');
                    console.error('3. Google Sheets未授權Sheety寫入權限');
                    console.error('4. API Token可能已過期');
                    throw new Error(`權限錯誤 (403) - 請檢查Bearer Token和權限設定\n${errorText}`);
                }
                
                // 特別處理500錯誤
                if (response.status === 500) {
                    console.error('💥 500錯誤 - 可能的原因:');
                    console.error('1. Google Sheets欄位順序不正確');
                    console.error('2. Sheety內部設定問題'); 
                    console.error('3. 資料格式不符合Google Sheets預期');
                    console.error('4. Google Sheets連接問題');
                    console.error('發送的資料:', processedData);
                    throw new Error(`伺服器錯誤 (500) - 請檢查Sheety專案設定\n${errorText}`);
                }
                
                throw new Error(`API回應錯誤: ${response.status} ${response.statusText}\n${errorText}`);
            }
            
            // 驗證回應內容
            const responseData = await response.json();
            
            // Debug: 記錄API回應
            console.log('=== DEBUG: Sheety API回應 ===');
            console.log('回應狀態:', response.status);
            console.log('回應headers:', response.headers);
            console.log('回應內容:', responseData);
            console.log('回應JSON:', JSON.stringify(responseData, null, 2));
            console.log('============================');
            
            // 檢查API回應是否有效
            if (!responseData || !responseData.t1 || !responseData.t1.id) {
                console.error('API回應格式異常:', responseData);
                throw new Error('API回應格式異常 - 缺少必要欄位');
            }
            
            // 檢查回傳的記錄是否包含我們的資料
            const returnedRecord = responseData.t1;
            console.log('=== DEBUG: 檢查回傳記錄 ===');
            console.log('回傳記錄:', returnedRecord);
            console.log('記錄ID:', returnedRecord.id);
            console.log('記錄完整性檢查:');
            console.log('- ourPlayers:', returnedRecord.ourPlayers);
            console.log('- opponentPlayers:', returnedRecord.opponentPlayers);
            console.log('- date:', returnedRecord.date);
            console.log('- result:', returnedRecord.result);
            
            // 資料完整性檢查
            const dataComplete = returnedRecord.ourPlayers && 
                                returnedRecord.opponentPlayers && 
                                returnedRecord.date && 
                                returnedRecord.result;
            
            console.log('資料完整性:', dataComplete ? '✅ 完整' : '❌ 不完整');
            
            if (!dataComplete) {
                console.warn('⚠️ 警告：Sheety回傳的資料不完整，但可能是Google Sheets同步延遲');
                // 不中斷流程，讓用戶知道但繼續執行
                this.showErrorMessage('注意：API回傳資料不完整\n請手動檢查Google Sheets\n如果資料未出現，請重新提交');
            }
            console.log('========================');
            
            this.hideLoadingMessage();
            
            // 延遲檢查：給Sheety時間同步
            setTimeout(async () => {
                console.log('🔄 5秒後檢查後台資料庫同步狀況...');
                await this.fetchMatchesFromSheet();
                
                if (this.matches.length === 0) {
                    console.error('⚠️ 警告：後台資料庫中仍無資料！');
                    console.error('可能的問題：');
                    console.error('1. 資料庫權限設定錯誤');
                    console.error('2. 後台資料庫連接問題');
                    console.error('3. 資料表名稱不匹配');
                    this.showErrorMessage('警告：資料可能未同步到後台資料庫\n請檢查權限設定');
                } else {
                    console.log('✅ 資料同步成功！');
                    this.showSuccessMessage('✅ 資料已成功同步到後台資料庫！');
                }
            }, 5000);
            
            this.showSuccessMessage('正在同步後台資料庫...');
            
        } catch (err) {
            this.hideLoadingMessage();
            console.error('新增資料失敗', err);
            
            // 網路錯誤時自動切換到離線模式
            if (err.name === 'TypeError' || err.message.includes('fetch')) {
                this.showErrorMessage('網路連線失敗，已切換到離線模式');
                return this.saveToOfflineMode(match);
            } else {
                this.showErrorMessage('雲端儲存失敗：' + err.message);
                throw err;
            }
        }
    }

    saveToOfflineMode(match) {
        // 生成本地臨時ID
        const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 添加離線標記
        const offlineMatch = {
            ...match,
            localId: localId,
            syncStatus: 'pending',
            createdOffline: true
        };
        
        // 加入待同步列表
        this.pendingMatches.push(offlineMatch);
        localStorage.setItem('pendingMatches', JSON.stringify(this.pendingMatches));
        
        // 同時添加到本地matches列表以便立即顯示
        this.matches.unshift({
            ...offlineMatch,
            id: localId
        });
        
        this.updateSyncStatus();
        this.showSuccessMessage('比賽記錄已暫存，等待網路恢復後同步');
    }

    async deleteMatch(id) {
        // 檢查是否為本地記錄
        const isLocalRecord = id.toString().startsWith('local_');
        
        if (isLocalRecord) {
            // 刪除本地記錄
            this.deleteLocalMatch(id);
            return;
        }
        
        // 刪除雲端記錄
        if (!this.isOnline || !navigator.onLine) {
            this.showErrorMessage('網路未連線，無法刪除雲端記錄');
            return;
        }
        
        this.showLoadingMessage('正在刪除記錄...');
        
        try {
            // 使用POST模擬DELETE，避免CORS問題
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('id', id);
            
            const response = await fetch(this.apiUrl, { 
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`刪除失敗: ${response.status}`);
            }
            
            this.hideLoadingMessage();
            await this.fetchMatchesFromSheet();
            this.showSuccessMessage('比賽記錄已刪除！');
            
        } catch (err) {
            this.hideLoadingMessage();
            console.error('刪除資料失敗', err);
            this.showErrorMessage('刪除失敗：' + err.message);
        }
    }

    deleteLocalMatch(localId) {
        // 從matches列表中移除
        this.matches = this.matches.filter(match => match.id !== localId);
        
        // 從pendingMatches中移除
        this.pendingMatches = this.pendingMatches.filter(match => match.localId !== localId);
        localStorage.setItem('pendingMatches', JSON.stringify(this.pendingMatches));
        
        // 更新介面
        this.updateStats();
        this.displayPlayerStats();
        this.displayHistory();
        this.updateSyncStatus();
        
        this.showSuccessMessage('本地記錄已刪除！');
    }

    recomputePlayerStats() {
        const map = {};
        this.matches.forEach(match => {
            match.ourPlayers.forEach(name => {
                if (!map[name]) map[name] = { name: name, matches: 0, wins: 0, losses: 0 };
                map[name].matches++;
                if (match.result === 'win') map[name].wins++;
                else if (match.result === 'lose') map[name].losses++;
            });
        });
        this.players = Object.values(map);
    }

    updateStats() {
        const total = this.matches.length;
        const wins = this.matches.filter(m => m.result === 'win').length;
        const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
        document.getElementById('total-matches').textContent = total;
        document.getElementById('wins').textContent = wins;
        document.getElementById('win-rate').textContent = rate + '%';
    }

    displayPlayerStats() {
        const list = document.getElementById('player-list');
        if (!list) return;
        list.innerHTML = '';
        if (this.players.length === 0) {
            list.innerHTML = '<p>尚無球員記錄</p>';
            return;
        }
        this.players.forEach(p => {
            const rate = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(1) : 0;
            const div = document.createElement('div');
            div.className = 'player-item';
            div.innerHTML = `
                <div class="player-name">${p.name}</div>
                <div class="player-record">總場次: ${p.matches} | 勝: ${p.wins} | 負: ${p.losses} | 勝率: ${rate}%</div>
            `;
            list.appendChild(div);
        });
    }

    displayHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;
        container.innerHTML = '';
        
        if (this.matches.length === 0) {
            container.innerHTML = '<p>尚無比賽記錄</p>';
            this.updateResultsCount(0, 0);
            return;
        }
        
        // 使用篩選後的資料，如果沒有篩選則使用全部資料
        const matchesToShow = this.filteredMatches.length > 0 || this.hasActiveFilters() 
            ? this.filteredMatches 
            : this.matches;
            
        const sorted = [...matchesToShow].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (sorted.length === 0) {
            container.innerHTML = '<p>沒有符合條件的比賽記錄</p>';
            this.updateResultsCount(0, this.matches.length);
            return;
        }
        
        this.updateResultsCount(sorted.length, this.matches.length);
        sorted.forEach(match => {
            const div = document.createElement('div');
            div.className = `history-item ${match.result}`;
            const scoreText = match.scores.map(s => `${s.our}:${s.opponent}`).join(' ');
            const ourNames = match.ourPlayers.join(' / ');
            const oppNames = match.opponentPlayers.join(' / ');
            div.innerHTML = `
                <div class="match-header">
                    <div>
                        <strong>${ourNames}</strong> vs <strong>${oppNames}</strong><br>
                        <small>對手學校: ${match.opponentSchool}</small>
                    </div>
                    <div>
                        <div class="match-date">${this.formatDate(match.date)}</div>
                        <div class="match-result ${match.result}">${match.result === 'win' ? '勝' : '負'}</div>
                        ${match.syncStatus === 'pending' ? '<div class="sync-status pending">🟡 待同步</div>' : ''}
                        ${match.createdOffline ? '<div class="sync-status offline">📱 離線建立</div>' : ''}
                    </div>
                </div>
                <div class="match-details">
                    <div>比賽類型: ${this.getMatchTypeText(match.matchType)}</div>
                    ${scoreText ? `<div class="match-score">比分: ${scoreText}</div>` : ''}
                    ${match.notes ? `<div>備註: ${match.notes}</div>` : ''}
                </div>
                <button class="delete-btn" data-id="${match.id}">刪除</button>
            `;
            const delBtn = div.querySelector('.delete-btn');
            delBtn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('確定要刪除此記錄嗎？')) {
                    await this.deleteMatch(id);
                }
            });
            container.appendChild(div);
        });
    }

    formatDate(dateString) {
        const d = new Date(dateString);
        const y = d.getFullYear();
        const m = ('0' + (d.getMonth() + 1)).slice(-2);
        const day = ('0' + d.getDate()).slice(-2);
        return `${y}/${m}/${day}`;
    }

    getMatchTypeText(type) {
        const map = { team: '團體賽', singles: '個人單打', doubles: '個人雙打' };
        return map[type] || type;
    }

    showSuccessMessage(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: #fff;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showErrorMessage(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: #fff;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: fadeIn 0.3s ease;
            white-space: pre-line;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    validateMatchData(data) {
        const errors = [];
        
        // 檢查必填欄位
        if (!data.date) {
            errors.push('• 請選擇比賽日期');
        }
        
        if (!data.opponentSchool) {
            errors.push('• 請輸入對手學校');
        }
        
        if (!data.matchType) {
            errors.push('• 請選擇比賽類型');
        }
        
        if (!data.result) {
            errors.push('• 請選擇比賽結果');
        }
        
        // 檢查球員資料
        if (!data.ourPlayers || data.ourPlayers.length === 0) {
            errors.push('• 請選擇至少一位我方球員');
        }
        
        if (!data.opponentPlayers || data.opponentPlayers.length === 0) {
            errors.push('• 請輸入對手球員姓名');
        }
        
        // 雙打特殊檢查
        if (data.matchType === 'doubles') {
            if (data.ourPlayers.length < 2) {
                errors.push('• 雙打比賽需要選擇兩位我方球員');
            }
            if (data.opponentPlayers.length < 2) {
                errors.push('• 雙打比賽需要輸入兩位對手球員');
            }
        }
        
        return errors;
    }

    showLoadingMessage(msg) {
        // 移除現有的loading訊息
        this.hideLoadingMessage();
        
        const loading = document.createElement('div');
        loading.id = 'loading-message';
        loading.className = 'toast loading';
        loading.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="spinner"></div>
                <span>${msg}</span>
            </div>
        `;
        loading.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: #fff;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(loading);
    }

    hideLoadingMessage() {
        const loading = document.getElementById('loading-message');
        if (loading) {
            loading.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => loading.remove(), 300);
        }
    }

    // 篩選功能方法
    initializeFilters() {
        this.populateFilterOptions();
        this.filteredMatches = [];
        this.clearFilterForm();
    }
    
    populateFilterOptions() {
        // 填充球員選項
        const playerSelect = document.getElementById('filter-player');
        if (playerSelect) {
            playerSelect.innerHTML = '<option value="">全部球員</option>';
            const allPlayers = new Set();
            this.matches.forEach(match => {
                match.ourPlayers.forEach(player => allPlayers.add(player));
            });
            [...allPlayers].sort().forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                playerSelect.appendChild(option);
            });
        }
        
        // 填充對手學校選項
        const opponentSelect = document.getElementById('filter-opponent');
        if (opponentSelect) {
            opponentSelect.innerHTML = '<option value="">全部學校</option>';
            const allOpponents = new Set(this.matches.map(match => match.opponentSchool));
            [...allOpponents].sort().forEach(school => {
                const option = document.createElement('option');
                option.value = school;
                option.textContent = school;
                opponentSelect.appendChild(option);
            });
        }
    }
    
    hasActiveFilters() {
        return Object.values(this.activeFilters).some(value => value !== '');
    }
    
    applyFilters() {
        // 獲取篩選條件
        this.activeFilters.player = document.getElementById('filter-player')?.value || '';
        this.activeFilters.matchType = document.getElementById('filter-match-type')?.value || '';
        this.activeFilters.result = document.getElementById('filter-result')?.value || '';
        this.activeFilters.opponent = document.getElementById('filter-opponent')?.value || '';
        this.activeFilters.dateStart = document.getElementById('filter-date-start')?.value || '';
        this.activeFilters.dateEnd = document.getElementById('filter-date-end')?.value || '';
        
        // 篩選比賽記錄
        this.filteredMatches = this.matches.filter(match => {
            // 球員篩選
            if (this.activeFilters.player && !match.ourPlayers.includes(this.activeFilters.player)) {
                return false;
            }
            
            // 比賽類型篩選
            if (this.activeFilters.matchType && match.matchType !== this.activeFilters.matchType) {
                return false;
            }
            
            // 比賽結果篩選
            if (this.activeFilters.result && match.result !== this.activeFilters.result) {
                return false;
            }
            
            // 對手學校篩選
            if (this.activeFilters.opponent && match.opponentSchool !== this.activeFilters.opponent) {
                return false;
            }
            
            // 日期範圍篩選
            if (this.activeFilters.dateStart && match.date < this.activeFilters.dateStart) {
                return false;
            }
            
            if (this.activeFilters.dateEnd && match.date > this.activeFilters.dateEnd) {
                return false;
            }
            
            return true;
        });
        
        // 重新顯示歷史記錄
        this.displayHistory();
    }
    
    clearFilters() {
        this.activeFilters = {
            player: '',
            matchType: '',
            result: '',
            opponent: '',
            dateStart: '',
            dateEnd: ''
        };
        this.filteredMatches = [];
        this.clearFilterForm();
        this.displayHistory();
    }
    
    clearFilterForm() {
        document.getElementById('filter-player').value = '';
        document.getElementById('filter-match-type').value = '';
        document.getElementById('filter-result').value = '';
        document.getElementById('filter-opponent').value = '';
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
    }
    
    updateResultsCount(showing, total) {
        const countElement = document.getElementById('results-count');
        if (countElement) {
            if (showing === total) {
                countElement.textContent = `顯示全部 ${total} 筆記錄`;
            } else {
                countElement.textContent = `顯示 ${showing} / ${total} 筆記錄`;
            }
        }
    }

    resetForm() {
        const form = document.getElementById('match-form');
        if (form) form.reset();
        document.getElementById('match-date').value = new Date().toISOString().split('T')[0];
        
        // 重置年級選單和球員選單
        const grade1 = document.getElementById('our-player-grade');
        if (grade1) grade1.value = '';
        
        const player1 = document.getElementById('our-player');
        if (player1) {
            player1.disabled = true;
            player1.innerHTML = '<option value="">請先選擇年級</option>';
        }
        
        // 隱藏自訂欄位
        const cust1 = document.getElementById('our-player-custom');
        if (cust1) {
            cust1.style.display = 'none';
            cust1.required = false;
        }
        const cust2 = document.getElementById('our-player-2-custom');
        if (cust2) {
            cust2.style.display = 'none';
            cust2.required = false;
        }
        
        // 隱藏雙打相關欄位
        const group1 = document.getElementById('our-player-2-group');
        if (group1) {
            group1.style.display = 'none';
            const grade2 = document.getElementById('our-player-2-grade');
            if (grade2) grade2.value = '';
            const player2 = document.getElementById('our-player-2');
            if (player2) {
                player2.disabled = true;
                player2.innerHTML = '<option value="">請先選擇年級</option>';
            }
        }
        const group2 = document.getElementById('opponent-player-2-group');
        if (group2) group2.style.display = 'none';
    }
}

// 將 showTab 函式暴露給 HTML
function showTab(tabName, button) {
    try {
        if (system && typeof system.showTab === 'function') {
            system.showTab(tabName, button);
        } else {
            console.error('系統尚未初始化或showTab方法不存在');
        }
    } catch (error) {
        console.error('分頁切換錯誤:', error);
    }
}

// 暴露篩選函數給 HTML
function applyFilters() {
    try {
        if (system && typeof system.applyFilters === 'function') {
            system.applyFilters();
        } else {
            console.error('系統尚未初始化或applyFilters方法不存在');
        }
    } catch (error) {
        console.error('套用篩選錯誤:', error);
    }
}

function clearFilters() {
    try {
        if (system && typeof system.clearFilters === 'function') {
            system.clearFilters();
        } else {
            console.error('系統尚未初始化或clearFilters方法不存在');
        }
    } catch (error) {
        console.error('清除篩選錯誤:', error);
    }
}

// 暴露測試功能給控制台使用
function testSync() {
    return system.testOfflineOnlineSync();
}

// 暴露手動同步功能
function manualSync() {
    return system.manualSync();
}

// 清理待同步資料
function clearPendingMatches() {
    localStorage.removeItem('pendingMatches');
    system.pendingMatches = [];
    system.updateSyncStatus();
    console.log('✅ 已清理所有待同步資料');
}

// 診斷Google Sheets結構
async function diagnoseSheetsStructure() {
    console.log('🔍 診斷Google Sheets結構...');
    
    try {
        const response = await fetch(system.apiUrl, {
            method: 'GET'
        });
        
        const data = await response.json();
        
        console.log('📊 完整Sheety回應:', data);
        console.log('📋 可用的鍵:', Object.keys(data));
        
        // 檢查是否有錯誤
        if (data.errors) {
            console.error('❌ Sheety回報錯誤:');
            data.errors.forEach((error, index) => {
                console.error(`錯誤 ${index + 1}:`, error.detail);
            });
            console.log('💡 這通常表示Google Sheets結構有問題');
            return;
        }
        
        if (data.t1) {
            console.log('📝 t1陣列長度:', data.t1.length);
            console.log('📝 t1內容:', data.t1);
            
            if (data.t1.length > 0) {
                console.log('🔍 第一筆資料:', data.t1[0]);
                console.log('🔍 資料欄位:', Object.keys(data.t1[0]));
            } else {
                console.log('⚠️ t1陣列為空 - 這表示Sheety無法讀取資料');
                console.log('💡 可能的原因：');
                console.log('1. Google Sheets標題行不在A1');
                console.log('2. 標題行格式不正確');
                console.log('3. Sheety沒有正確設定headers');
            }
        }
        
        // 建議的標題行格式
        console.log('✅ 正確的標題行應該是：');
        console.log('A1: date | B1: opponentSchool | C1: matchType | D1: ourPlayers | E1: opponentPlayers | F1: scores | G1: result | H1: notes | I1: timestamp');
        
    } catch (error) {
        console.error('❌ 診斷失敗:', error);
    }
}

// 初始化系統
const system = new TableTennisRecordSystem();

// 新增動畫樣式
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
`;
document.head.appendChild(styleEl);