document.addEventListener('DOMContentLoaded', () => {
    // blockly-div 要素を取得
    const blocklyArea = document.getElementById('blockly-div');

    // Blocklyのワークスペースを注入 (inject)
    const workspace = Blockly.inject(blocklyArea, {
        toolbox: document.getElementById('toolbox'),
        scrollbars: true,
        trashcan: true,
        move: {
            scrollbars: {
                horizontal: true,
                vertical: true
            },
            drag: true,
            wheel: true
        }
    });

    // ウィンドウのリサイズイベントでBlocklyのサイズを自動調整
    window.addEventListener('resize', () => {
        Blockly.svgResize(workspace);
    }, false);
    
    // 初期化直後に一度リサイズイベントを発火させて枠にぴったりはめる
    Blockly.svgResize(workspace);

    // Blockly Generator Selection (Compatible with old and new versions)
    const javascriptGenerator = Blockly.JavaScript || (window.javascript && window.javascript.javascriptGenerator);

    // Custom Blocks Definition
    Blockly.Blocks['when_run'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚩 が押されたとき");
            this.setNextStatement(true, null);
            this.setColour(60);
        }
    };
    javascriptGenerator.forBlock['when_run'] = function(block, generator) {
        return ''; 
    };

    Blockly.Blocks['move_forward'] = {
        init: function() {
            this.appendDummyInput().appendField("前にすすむ");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(20);
        }
    };
    javascriptGenerator.forBlock['move_forward'] = function(block, generator) {
        return 'await game.moveForward();\n';
    };

    Blockly.Blocks['jump'] = {
        init: function() {
            this.appendValueInput("HEIGHT")
                .setCheck("Number")
                .appendField("ジャンプ！ 高さ:");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(20);
        }
    };
    javascriptGenerator.forBlock['jump'] = function(block, generator) {
        const height = generator.valueToCode(block, 'HEIGHT', javascriptGenerator.ORDER_ATOMIC) || '80';
        return `await game.jump(${height});\n`;
    };

    // Game Logic Object
    const game = {
        playerX: 20,
        isJumping: false,
        jumpHeight: 0,
        isGameOver: false,
        rockX: 300,
        goalX: 550,
        
        reset: function() {
            this.playerX = 20;
            this.isJumping = false;
            this.jumpHeight = 0;
            this.isGameOver = false;
            this.updateUI();
            const logEl = document.getElementById('ai-log');
            if (logEl) logEl.innerHTML = '';
            this.log('Game Reset. Ready!');
            this.updateBubble('どうすればいいかな？');
        },

        updateUI: function() {
            const playerEl = document.getElementById('player');
            if (playerEl) {
                playerEl.style.left = this.playerX + 'px';
                playerEl.style.bottom = (this.isJumping ? this.jumpHeight + 'px' : '0px');
                
                if (this.isGameOver) {
                    playerEl.textContent = '💥';
                } else {
                    playerEl.textContent = '🏃';
                }
            }
        },

        log: function(msg) {
            const logEl = document.getElementById('ai-log');
            if (logEl) {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.textContent = msg;
                logEl.appendChild(entry);
                logEl.scrollTop = logEl.scrollHeight;
            }
        },

        updateBubble: function(msg) {
            const bubbleEl = document.querySelector('.speech-bubble');
            if (bubbleEl) {
                bubbleEl.textContent = msg;
            }
        },

        moveForward: async function() {
            if (this.isGameOver) return;
            this.updateBubble('進むよ！');
            this.log('AI: 前に進むことを決定。');
            for (let i = 0; i < 10; i++) {
                this.playerX += 5;
                this.checkCollision();
                this.updateUI();
                await new Promise(r => setTimeout(r, 50));
                if (this.isGameOver) break;
            }
            if (!this.isGameOver) this.log('AI: 移動完了。');
        },

        jump: async function(height) {
            if (this.isGameOver) return;
            const h = parseInt(height) || 80;
            this.updateBubble(`ジャンプ！(高さ:${h})`);
            this.log(`AI: 高さ ${h} でジャンプを試みます。`);
            this.isJumping = true;
            this.jumpHeight = h;
            this.updateUI();
            
            // ジャンプ中の移動
            for (let i = 0; i < 10; i++) {
                this.playerX += 5;
                // 石の上（300px付近）を通過するときに高さが足りるか判定
                this.checkCollision(h);
                this.updateUI();
                await new Promise(r => setTimeout(r, 50));
                if (this.isGameOver) break;
            }
            
            this.isJumping = false;
            this.jumpHeight = 0;
            this.updateUI();
            if (!this.isGameOver) this.log('AI: 着地成功。');
        },

        checkCollision: function(currentJumpHeight = 0) {
            // 岩との判定 (岩の高さは 50)
            if (Math.abs(this.playerX - this.rockX) < 30) {
                // ジャンプ中であっても、高さが50未満なら激突
                if (!this.isJumping || currentJumpHeight < 50) {
                    this.isGameOver = true;
                    if (this.isJumping) {
                        this.log(`AI: 高さ ${currentJumpHeight} では足りなかった！石に激突！`);
                    } else {
                        this.log('AI: ジャンプし忘れて、石に当たっちゃった！');
                    }
                    this.updateBubble('ギャアアア！');
                }
            }
            // ゴール判定
            if (this.playerX >= this.goalX) {
                this.log('AI: ゴール！大成功だね！');
                this.updateBubble('やったね！');
                this.isGameOver = true; 
            }
        }
    };

    // AI Controller for Animation and Placement
    const aiController = {
        isOperating: false,

        async interpretAndAct(input) {
            if (this.isOperating) return;
            this.isOperating = true;
            
            game.log(`User: "${input}"`);
            game.updateBubble('なるほど、まかせて！');
            await new Promise(r => setTimeout(r, 1000));

            workspace.clear(); 
            
            // 数値を抽出
            const match = input.match(/\d+/);
            const userHeight = match ? parseInt(match[0]) : null;

            let blocksToAdd = [];
            if (userHeight !== null) {
                game.log(`AI: 高さ ${userHeight} を理解しました。指示通りに組んでみます。`);
                blocksToAdd = [
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'jump', value: userHeight },
                    { type: 'move_forward' },
                    { type: 'move_forward' }
                ];
            } else if (input.includes('近く') || input.includes('具体')) {
                game.log('AI: タイミングは分かったけど高さは...適当に80にしておくね！信号なしだと失敗しちゃうかも。');
                blocksToAdd = [
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'jump', value: 80 },
                    { type: 'move_forward' },
                    { type: 'move_forward' }
                ];
            } else {
                game.log('AI: よくわからないけど、とりあえず低めに飛んでみるね！');
                blocksToAdd = [
                    { type: 'move_forward' },
                    { type: 'move_forward' },
                    { type: 'jump', value: 30 }, // あえて失敗させる例
                    { type: 'move_forward' }
                ];
            }

            await this.placeBlocksSequentially(blocksToAdd);
            
            game.updateBubble('できたよ！実行してみて！');
            this.isOperating = false;
        },

        async placeBlocksSequentially(blockData) {
            const hand = document.getElementById('ai-hand');
            const aiChara = document.getElementById('ai-chara');
            const blocklyDiv = document.getElementById('blockly-div');
            
            hand.style.display = 'block';
            
            const startX = blocklyDiv.offsetWidth / 2 - 100;
            const startY = 380; 

            // 旗ブロック
            await this.animateHandTo(hand, aiChara, blocklyDiv, startX, startY);
            const flagBlock = workspace.newBlock('when_run');
            flagBlock.initSvg();
            flagBlock.render();
            flagBlock.moveBy(startX, startY);
            
            let lastBlock = flagBlock;
            let currentOffset = 50;

            for (const item of blockData) {
                await this.animateHandTo(hand, aiChara, blocklyDiv, startX, startY + currentOffset);
                
                const newBlock = workspace.newBlock(item.type);
                newBlock.initSvg();
                newBlock.render();
                newBlock.moveBy(startX, startY + currentOffset);

                // 数値のセット (jumpの場合)
                if (item.type === 'jump' && item.value !== undefined) {
                    const input = newBlock.getInput('HEIGHT');
                    if (input && input.connection) {
                        const shadow = input.connection.targetBlock();
                        if (shadow) {
                            shadow.setFieldValue(item.value.toString(), 'NUM');
                        } else {
                            const numBlock = workspace.newBlock('math_number');
                            numBlock.setFieldValue(item.value.toString(), 'NUM');
                            numBlock.initSvg();
                            numBlock.render();
                            input.connection.connect(numBlock.outputConnection);
                        }
                    }
                }

                newBlock.previousConnection.connect(lastBlock.nextConnection);
                
                lastBlock = newBlock;
                currentOffset += 60;
            }

            // 手を戻す
            const charaRectFinal = aiChara.getBoundingClientRect();
            hand.style.left = charaRectFinal.left + 'px';
            hand.style.top = charaRectFinal.top + 'px';
            await new Promise(r => setTimeout(r, 500));
            hand.style.display = 'none';
        },

        async animateHandTo(hand, aiChara, blocklyDiv, targetX, targetY) {
            // 手をAIキャラの位置に移動（準備）
            const charaRect = aiChara.getBoundingClientRect();
            hand.style.left = charaRect.left + 'px';
            hand.style.top = charaRect.top + 'px';
            await new Promise(r => setTimeout(r, 200));

            // 手をターゲットに移動
            hand.style.left = (blocklyDiv.offsetLeft + targetX + 50) + 'px';
            hand.style.top = (blocklyDiv.offsetTop + targetY + 20) + 'px';
            await new Promise(r => setTimeout(r, 500));

            // 配置時のクリックアニメ
            hand.classList.add('hand-grabbing');
            await new Promise(r => setTimeout(r, 200));
            hand.classList.remove('hand-grabbing');
        }
    };

    // VIBEボタンの処理
    const vibeBtn = document.getElementById('vibe-btn');
    const vibeInput = document.getElementById('vibe-input');

    if (vibeBtn && vibeInput) {
        vibeBtn.addEventListener('click', () => {
            const input = vibeInput.value.trim();
            if (input) {
                aiController.interpretAndAct(input);
                vibeInput.value = '';
            }
        });

        vibeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') vibeBtn.click();
        });
    }

    // 実行ボタンの処理
    const runButton = document.getElementById('run-button');
    if (runButton) {
        runButton.addEventListener('click', async () => {
            game.reset();
            
            // Javascriptコードを生成 
            // すべてのブロックのコードを生成
            const code = javascriptGenerator.workspaceToCode(workspace);
            
            console.log('生成されたコード:\n', code);
            
            if (!code.trim()) {
                game.log('AI: 実行できるコードがないよ！ブロックを置いてみてね。');
                return;
            }

            try {
                // 非同期実行のためにラップ
                const asyncCode = `(async () => {
                    ${code}
                })()`;
                eval(asyncCode);
            } catch (e) {
                console.error('実行エラー:', e);
                game.log('エラーが発生しました: ' + e);
            }
        });
    }

    // 初期化時リセット
    game.reset();
});