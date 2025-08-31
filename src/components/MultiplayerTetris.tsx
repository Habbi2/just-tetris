'use client'

import { useEffect, useRef, useState } from 'react'
import * as Phaser from 'phaser'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface MultiplayerTetrisProps {
  roomId: string
  roomCode: string
  playerNumber: number
  playerName: string
  onGameEnd: () => void
}

class MultiplayerTetrisScene extends Phaser.Scene {
  private grid: (string | number)[][]
  private opponentGrid: (string | number)[][]
  private currentPiece: any
  private nextPiece: any
  private holdPiece: any | null
  private score: number
  private level: number
  private lines: number
  private combo: number
  private dropTime: number
  private lastDropTime: number
  private gameOver: boolean
  private opponentGameOver: boolean
  private roomId!: string
  private playerNumber!: number
  private playerName!: string
  private onGameEnd!: () => void
  private supabase: any
  private hasHeldThisTurn: boolean
  private attackQueue: number[]
  private pendingAttackLines: number
  
  // Rendering layers
  private gridLayer?: Phaser.GameObjects.Container
  private ghostLayer?: Phaser.GameObjects.Container
  private pieceLayer?: Phaser.GameObjects.Container
  private nextLayer?: Phaser.GameObjects.Container
  private holdLayer?: Phaser.GameObjects.Container
  private opponentGridLayer?: Phaser.GameObjects.Container
  private opponentCurrentPiece: any | null
  private statePollInterval?: any
  private hiddenStartTs: number | null
  private pendingResumeDrops: number

  constructor() {
    super({ key: 'MultiplayerTetrisScene' })
    this.grid = []
    this.opponentGrid = []
    this.score = 0
    this.level = 1
    this.lines = 0
    this.combo = 0
    this.dropTime = 1000
    this.lastDropTime = 0
    this.gameOver = false
    this.opponentGameOver = false
    this.holdPiece = null
    this.hasHeldThisTurn = false
    this.attackQueue = []
    this.pendingAttackLines = 0
  this.opponentCurrentPiece = null
  this.hiddenStartTs = null
  this.pendingResumeDrops = 0
  }

  init(data: any) {
    this.roomId = data.roomId
    this.playerNumber = data.playerNumber
    this.playerName = data.playerName
    this.onGameEnd = data.onGameEnd
    this.supabase = data.supabase
  }

  preload() {
    // Generate solid tile textures
    const colors = ['cyan', 'yellow', 'purple', 'orange', 'blue', 'green', 'red', 'gray', 'darkgray']

    colors.forEach(color => {
      const g = this.add.graphics()
      g.fillStyle(this.getColorHex(color), 1)
      g.fillRect(0, 0, 24, 24) // Smaller blocks for dual view
      g.generateTexture(color, 24, 24)
      g.destroy()
    })
  }

  create() {
    this.children.removeAll()
    
    this.initializeGrids()
    this.nextPiece = this.generateRandomPiece()
    this.spawnNewPiece()
    
    // Create render layers
    this.gridLayer = this.add.container(0, 0)
    this.ghostLayer = this.add.container(0, 0)
    this.pieceLayer = this.add.container(0, 0)
    this.nextLayer = this.add.container(0, 0)
    this.holdLayer = this.add.container(0, 0)
    this.opponentGridLayer = this.add.container(0, 0)

    this.createUI()
    this.setupInput()
    this.setupRealtimeSync()
    this.renderGrid()
    // Publish initial state so opponent can see your board immediately
    this.syncGameState()
    // Also fetch opponent state immediately and start polling as a fallback
    this.fetchOpponentState()
    this.startPollingOpponentState()

    // Clean up on shutdown/destroy
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.statePollInterval) clearInterval(this.statePollInterval)
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
    })

    // Track visibility so the game advances fairly while minimized
    document.addEventListener('visibilitychange', this._onVisibilityChange)
  }

  update(time: number) {
    if (this.gameOver) return

    // If we were hidden, fast-forward the number of missed drops
    if (this.pendingResumeDrops > 0) {
      const drops = Math.min(this.pendingResumeDrops, 50) // safety cap per frame
      for (let i = 0; i < drops && !this.gameOver; i++) {
        this.dropPiece()
      }
      this.pendingResumeDrops -= drops
      this.lastDropTime = time
      // After fast-forwarding ensure UI is correct
      this.renderGrid()
      return
    }

    if (time - this.lastDropTime > this.dropTime) {
      this.dropPiece()
      this.lastDropTime = time
    }

    // Process pending attack lines
    if (this.attackQueue.length > 0 && !this.gameOver) {
      this.processAttackLines()
    }
  }

  private _onVisibilityChange = () => {
    if (document.hidden) {
      this.hiddenStartTs = Date.now()
    } else {
      if (this.hiddenStartTs) {
        const elapsed = Date.now() - this.hiddenStartTs
        const missed = Math.floor(elapsed / this.dropTime)
        if (missed > 0) this.pendingResumeDrops += missed
        this.hiddenStartTs = null
      }
    }
  }

  private getColorHex(color: string): number {
    const colors: { [key: string]: number } = {
      cyan: 0x00FFFF,
      yellow: 0xFFFF00,
      purple: 0x800080,
      orange: 0xFFA500,
      blue: 0x0000FF,
      green: 0x00FF00,
      red: 0xFF0000,
      gray: 0x808080,
      darkgray: 0x404040
    }
    return colors[color] || 0x808080
  }

  private initializeGrids() {
    this.grid = Array(20).fill(null).map(() => Array(10).fill(0))
    this.opponentGrid = Array(20).fill(null).map(() => Array(10).fill(0))
  }

  private generateRandomPiece() {
    const pieces = [
      { shape: [[1,1,1,1]], color: 'cyan' },
      { shape: [[1,1],[1,1]], color: 'yellow' },
      { shape: [[0,1,0],[1,1,1]], color: 'purple' },
      { shape: [[0,1,1],[1,1,0]], color: 'green' },
      { shape: [[1,1,0],[0,1,1]], color: 'red' },
      { shape: [[1,0,0],[1,1,1]], color: 'orange' },
      { shape: [[0,0,1],[1,1,1]], color: 'blue' }
    ]
    const base = pieces[Math.floor(Math.random() * pieces.length)]
    return { shape: base.shape.map(row => [...row]), color: base.color }
  }

  private spawnNewPiece() {
    const usePiece = this.nextPiece || this.generateRandomPiece()
    const shape = usePiece.shape.map((row: any[]) => [...row])
    this.currentPiece = {
      shape,
      color: usePiece.color,
      x: Math.floor((10 - shape[0].length) / 2),
      y: 0
    }
    this.nextPiece = this.generateRandomPiece()
    this.hasHeldThisTurn = false

    if (this.checkCollision(this.currentPiece)) {
      this.endGame()
    }
  }

  private checkCollision(piece: any, dx = 0, dy = 0): boolean {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x + dx
          const newY = piece.y + y + dy

          if (newX < 0 || newX >= 10 || newY >= 20) return true
          if (newY >= 0 && this.grid[newY][newX]) return true
        }
      }
    }
    return false
  }

  private dropPiece() {
    if (!this.checkCollision(this.currentPiece, 0, 1)) {
      this.currentPiece.y++
    } else {
      this.placePiece()
      const cleared = this.clearLines()
      this.handleLineClears(cleared)
      this.spawnNewPiece()
      this.syncGameState()
    }
    this.renderGrid()
  }

  private placePiece() {
    for (let y = 0; y < this.currentPiece.shape.length; y++) {
      for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
        if (this.currentPiece.shape[y][x]) {
          const gridY = this.currentPiece.y + y
          const gridX = this.currentPiece.x + x
          if (gridY >= 0) {
            this.grid[gridY][gridX] = this.currentPiece.color
          }
        }
      }
    }
  }

  private clearLines() {
    let linesCleared = 0
    for (let y = this.grid.length - 1; y >= 0; y--) {
      if (this.grid[y].every(cell => cell !== 0)) {
        this.grid.splice(y, 1)
        this.grid.unshift(Array(10).fill(0))
        linesCleared++
        y++
      }
    }
    return linesCleared
  }

  private handleLineClears(cleared: number) {
    if (cleared > 0) {
      this.lines += cleared
      this.score += cleared * 100 * this.level
      this.combo += 1
      
      if (this.combo > 1) {
        this.score += (this.combo - 1) * 50 * this.level
      }

      // Send attack lines to opponent
      let attackLines = 0
      if (cleared === 1) attackLines = 0
      else if (cleared === 2) attackLines = 1
      else if (cleared === 3) attackLines = 2
      else if (cleared === 4) attackLines = 4 // Tetris!

      // Combo bonus
      if (this.combo > 1) {
        attackLines += Math.floor(this.combo / 2)
      }

      if (attackLines > 0) {
        this.sendAttackLines(attackLines)
      }

      this.level = Math.floor(this.lines / 10) + 1
      this.dropTime = Math.max(100, 1000 - (this.level - 1) * 100)
      this.updateUI()
    } else {
      this.combo = 0
      this.updateUI()
    }
  }

  private async sendAttackLines(count: number) {
    try {
      const opponentNumber = this.playerNumber === 1 ? 2 : 1
      await this.supabase
        .from('attack_queue')
        .insert([{
          room_id: this.roomId,
          from_player: this.playerNumber,
          to_player: opponentNumber,
          lines_count: count
        }])
    } catch (error) {
      console.error('Error sending attack lines:', error)
    }
  }

  private processAttackLines() {
    const linesToAdd = Math.min(this.attackQueue.length, 1) // Process one at a time
    if (linesToAdd === 0) return

    // Add gray lines at bottom, shift existing up
    for (let i = 0; i < linesToAdd; i++) {
      this.grid.pop() // Remove top line
      const grayLine = Array(10).fill('darkgray')
      grayLine[Math.floor(Math.random() * 10)] = 0 // Random hole
      this.grid.unshift(grayLine)
    }

    this.attackQueue.splice(0, linesToAdd)
    this.renderGrid()
  }

  private renderGrid() {
    // Clear all layers
    this.gridLayer?.removeAll(true)
    this.ghostLayer?.removeAll(true)
    this.pieceLayer?.removeAll(true)
    this.nextLayer?.removeAll(true)
    this.holdLayer?.removeAll(true)
    this.opponentGridLayer?.removeAll(true)

    // Render player grid (left side)
    this.renderPlayerGrid(this.grid, 50, 50, this.gridLayer!)
    
    // Render opponent grid (right side)
    this.renderPlayerGrid(this.opponentGrid, 350, 50, this.opponentGridLayer!, true)
    // Render opponent current piece (overlay)
    if (this.opponentCurrentPiece) {
      for (let y = 0; y < this.opponentCurrentPiece.shape.length; y++) {
        for (let x = 0; x < this.opponentCurrentPiece.shape[y].length; x++) {
          if (this.opponentCurrentPiece.shape[y][x]) {
            const block = this.add.image(
              350 + (this.opponentCurrentPiece.x + x) * 24 + 12,
              50 + (this.opponentCurrentPiece.y + y) * 24 + 12,
              this.opponentCurrentPiece.color
            )
            block.setOrigin(0.5, 0.5)
            block.setAlpha(0.7)
            this.opponentGridLayer?.add(block)
          }
        }
      }
    }

    // Render ghost piece
    if (this.currentPiece) {
      const ghostPiece = { 
        ...this.currentPiece,
        shape: [...this.currentPiece.shape.map((row: any[]) => [...row])]
      }
      
      while (!this.checkCollision(ghostPiece, 0, 1)) {
        ghostPiece.y++
      }

      if (ghostPiece.y > this.currentPiece.y) {
        for (let y = 0; y < ghostPiece.shape.length; y++) {
          for (let x = 0; x < ghostPiece.shape[y].length; x++) {
            if (ghostPiece.shape[y][x]) {
              const ghostBlock = this.add.image(
                50 + (ghostPiece.x + x) * 24 + 12,
                50 + (ghostPiece.y + y) * 24 + 12,
                ghostPiece.color
              )
              ghostBlock.setOrigin(0.5, 0.5)
              ghostBlock.setAlpha(0.25)
              this.ghostLayer?.add(ghostBlock)
            }
          }
        }
      }
    }

    // Render current piece
    if (this.currentPiece) {
      for (let y = 0; y < this.currentPiece.shape.length; y++) {
        for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
          if (this.currentPiece.shape[y][x]) {
            const block = this.add.image(
              50 + (this.currentPiece.x + x) * 24 + 12,
              50 + (this.currentPiece.y + y) * 24 + 12,
              this.currentPiece.color
            )
            block.setOrigin(0.5, 0.5)
            block.setDepth(100)
            this.pieceLayer?.add(block)
          }
        }
      }
    }

    // Render previews
    if (this.nextPiece) {
      // Center inside NEXT box (x: 135..215, y: 540..600) => center (175, 570)
      this.drawPreview(this.nextPiece, 175, 570, this.nextLayer!)
    }
    if (this.holdPiece) {
      // Center inside HOLD box (x: 35..115, y: 540..600) => center (75, 570)
      this.drawPreview(this.holdPiece, 75, 570, this.holdLayer!)
    }
  }

  private renderPlayerGrid(grid: any[][], offsetX: number, offsetY: number, layer: Phaser.GameObjects.Container, isOpponent = false) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x]) {
          const block = this.add.image(
            offsetX + x * 24 + 12,
            offsetY + y * 24 + 12,
            grid[y][x] as string
          )
          block.setOrigin(0.5, 0.5)
          if (isOpponent) {
            block.setAlpha(0.7) // Dim opponent grid slightly
          }
          layer.add(block)
        }
      }
    }
  }

  private drawPreview(piece: any, centerX: number, centerY: number, layer: Phaser.GameObjects.Container) {
    const rows = piece.shape.length
    const cols = piece.shape[0].length
    const tile = 16
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (piece.shape[y][x]) {
          const img = this.add.image(
            centerX + (x - cols / 2 + 0.5) * tile,
            centerY + (y - rows / 2 + 0.5) * tile,
            piece.color
          )
          img.setDisplaySize(tile, tile)
          img.setOrigin(0.5, 0.5)
          layer.add(img)
        }
      }
    }
  }

  private createUI() {
    // Player grid border
    const g1 = this.add.graphics()
    g1.lineStyle(2, 0xffffff)
    g1.strokeRect(50, 50, 240, 480)
    
    // Opponent grid border
    const g2 = this.add.graphics()
    g2.lineStyle(2, 0xff6666)
    g2.strokeRect(350, 50, 240, 480)

    // Labels
    this.add.text(150, 20, 'YOU', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5)
    this.add.text(470, 20, 'OPPONENT', { fontSize: '20px', color: '#ff6666' }).setOrigin(0.5)

    // Player stats
    this.add.text(650, 50, 'SCORE', { fontSize: '18px', color: '#ffffff' })
    this.add.text(650, 80, '0', { fontSize: '20px', color: '#ffff00' }).setName('scoreText')
    
    this.add.text(650, 120, 'LEVEL', { fontSize: '18px', color: '#ffffff' })
    this.add.text(650, 150, '1', { fontSize: '20px', color: '#ffff00' }).setName('levelText')
    
    this.add.text(650, 190, 'LINES', { fontSize: '18px', color: '#ffffff' })
    this.add.text(650, 220, '0', { fontSize: '20px', color: '#ffff00' }).setName('linesText')

    this.add.text(650, 260, 'COMBO', { fontSize: '18px', color: '#ffffff' })
    this.add.text(650, 290, '0', { fontSize: '20px', color: '#00ffcc' }).setName('comboText')

    // Preview boxes
    const g3 = this.add.graphics()
    g3.lineStyle(1, 0xcccccc)
    this.add.text(50, 540 - 20, 'HOLD', { fontSize: '14px', color: '#ffffff' })
    g3.strokeRect(35, 540, 80, 60)
    
    this.add.text(150, 540 - 20, 'NEXT', { fontSize: '14px', color: '#ffffff' })
    g3.strokeRect(135, 540, 80, 60)

    // Controls
    this.add.text(650, 350, 'CONTROLS:', { fontSize: '16px', color: '#ffffff' })
    this.add.text(650, 375, 'A/D - Move', { fontSize: '12px', color: '#cccccc' })
    this.add.text(650, 395, 'S - Drop | W - Rotate', { fontSize: '12px', color: '#cccccc' })
    this.add.text(650, 415, 'Space - Hard Drop', { fontSize: '12px', color: '#cccccc' })
    this.add.text(650, 435, 'Shift - Hold', { fontSize: '12px', color: '#cccccc' })
  }

  private updateUI() {
    const scoreText = this.children.getByName('scoreText') as Phaser.GameObjects.Text
    const levelText = this.children.getByName('levelText') as Phaser.GameObjects.Text
    const linesText = this.children.getByName('linesText') as Phaser.GameObjects.Text
    const comboText = this.children.getByName('comboText') as Phaser.GameObjects.Text

    if (scoreText) scoreText.setText(this.score.toString())
    if (levelText) levelText.setText(this.level.toString())
    if (linesText) linesText.setText(this.lines.toString())
    if (comboText) comboText.setText(this.combo.toString())
  }

  private setupInput() {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.gameOver) return

      switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
          if (!this.checkCollision(this.currentPiece, -1, 0)) {
            this.currentPiece.x--
            this.renderGrid()
            this.syncGameState()
          }
          break
        case 'KeyD':
        case 'ArrowRight':
          if (!this.checkCollision(this.currentPiece, 1, 0)) {
            this.currentPiece.x++
            this.renderGrid()
            this.syncGameState()
          }
          break
        case 'KeyS':
        case 'ArrowDown':
          if (!this.checkCollision(this.currentPiece, 0, 1)) {
            this.currentPiece.y++
            this.renderGrid()
            this.syncGameState()
          }
          break
        case 'KeyW':
        case 'ArrowUp':
          this.rotatePiece()
          break
        case 'Space':
          this.hardDrop()
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          this.holdCurrentPiece()
          break
      }
    })
  }

  private rotatePiece() {
    if (this.currentPiece.color === 'yellow') return

    const rotated = this.currentPiece.shape[0].map((_: any, index: number) =>
      this.currentPiece.shape.map((row: any[]) => row[index]).reverse()
    )

    const oldShape = this.currentPiece.shape
    const oldX = this.currentPiece.x
    this.currentPiece.shape = rotated

    if (!this.checkCollision(this.currentPiece)) {
      this.renderGrid()
      this.syncGameState()
      return
    }

    const kicks = [-1, 1, -2, 2]
    for (const kick of kicks) {
      this.currentPiece.x = oldX + kick
      if (!this.checkCollision(this.currentPiece)) {
        this.renderGrid()
  this.syncGameState()
  return
      }
    }

    this.currentPiece.shape = oldShape
    this.currentPiece.x = oldX
  }

  private hardDrop() {
    while (!this.checkCollision(this.currentPiece, 0, 1)) {
      this.currentPiece.y++
    }
    this.placePiece()
    const cleared = this.clearLines()
    this.handleLineClears(cleared)
    this.spawnNewPiece()
    this.syncGameState()
    this.renderGrid()
  }

  private holdCurrentPiece() {
    if (this.hasHeldThisTurn || this.gameOver) return
    
    const toHold = {
      shape: this.currentPiece.shape.map((row: any[]) => [...row]),
      color: this.currentPiece.color
    }
    
    if (!this.holdPiece) {
      this.holdPiece = toHold
      this.spawnNewPiece()
    } else {
      const swapped = this.holdPiece
      this.holdPiece = toHold
      const shape = swapped.shape.map((row: any[]) => [...row])
      this.currentPiece = {
        shape,
        color: swapped.color,
        x: Math.floor((10 - shape[0].length) / 2),
        y: 0
      }
      if (this.checkCollision(this.currentPiece)) {
        this.endGame()
      }
    }
    this.hasHeldThisTurn = true
    this.renderGrid()
  this.syncGameState()
  }

  private async syncGameState() {
    try {
      const payload = {
        grid_state: this.grid,
        current_piece: this.currentPiece,
        next_piece: this.nextPiece,
        hold_piece: this.holdPiece,
        score: this.score,
        level: this.level,
        lines: this.lines,
        combo: this.combo,
        is_game_over: this.gameOver,
        updated_at: new Date().toISOString()
      }

      // Try update-first, insert-if-missing to avoid reliance on a unique index
      const { data: existing } = await this.supabase
        .from('game_state')
        .select('id')
        .eq('room_id', this.roomId)
        .eq('player_number', this.playerNumber)
        .maybeSingle()

      if (existing?.id) {
        await this.supabase
          .from('game_state')
          .update(payload)
          .eq('id', existing.id)
      } else {
        await this.supabase
          .from('game_state')
          .insert([{ 
            room_id: this.roomId, 
            player_number: this.playerNumber, 
            ...payload 
          }])
      }
    } catch (error) {
      console.error('Error syncing game state:', error)
    }
  }

  private setupRealtimeSync() {
    // Subscribe to opponent's game state
    const gameStateChannel = this.supabase
      .channel(`game-state-${this.roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `room_id=eq.${this.roomId}`
      }, (payload: any) => {
        if (payload.new && payload.new.player_number !== this.playerNumber) {
          this.updateOpponentState(payload.new)
        }
      })
      .subscribe()

    // Subscribe to incoming attack lines
    const attackChannel = this.supabase
      .channel(`attacks-${this.roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attack_queue',
        filter: `room_id=eq.${this.roomId}`
      }, (payload: any) => {
        if (payload.new && payload.new.to_player === this.playerNumber) {
          this.attackQueue.push(...Array(payload.new.lines_count).fill(1))
          // Mark as processed
          this.supabase
            .from('attack_queue')
            .update({ processed: true })
            .eq('id', payload.new.id)
        }
      })
      .subscribe()
  }

  private startPollingOpponentState() {
    if (this.statePollInterval) clearInterval(this.statePollInterval)
    this.statePollInterval = setInterval(() => {
      this.fetchOpponentState()
    }, 1000)
  }

  private async fetchOpponentState() {
    try {
      const { data } = await this.supabase
        .from('game_state')
        .select('*')
        .eq('room_id', this.roomId)
        .neq('player_number', this.playerNumber)
        .order('updated_at', { ascending: false })
        .limit(1)
      if (data && data[0]) {
        this.updateOpponentState(data[0])
      }
    } catch (e) {
      // ignore polling errors
    }
  }

  private updateOpponentState(state: any) {
    if (state.grid_state) {
      this.opponentGrid = state.grid_state
    }
    if (state.current_piece) {
      this.opponentCurrentPiece = state.current_piece
    }
    this.opponentGameOver = state.is_game_over
    this.renderGrid()
  }

  private async endGame() {
    this.gameOver = true
    
    try {
      await this.syncGameState()
      
      await this.supabase
        .from('game_players')
        .update({ 
          score: this.score,
          level: this.level,
          lines: this.lines,
          is_game_over: true
        })
        .eq('room_id', this.roomId)
        .eq('player_number', this.playerNumber)

      // Check if opponent also finished
      const { data: players } = await this.supabase
        .from('game_players')
        .select('*')
        .eq('room_id', this.roomId)

      const allFinished = players?.every((p: any) => p.is_game_over)
      
      if (allFinished) {
        await this.supabase
          .from('game_rooms')
          .update({ 
            status: 'finished',
            finished_at: new Date().toISOString()
          })
          .eq('id', this.roomId)
      }
    } catch (error) {
      console.error('Error ending game:', error)
    }

    const winner = this.opponentGameOver ? 'You Win!' : 'Game Over'
    this.add.text(400, 300, winner, { 
      fontSize: '32px', 
      color: this.opponentGameOver ? '#00ff00' : '#ff0000',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)

    this.add.text(400, 350, `Final Score: ${this.score}`, { 
      fontSize: '18px', 
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5)

    this.add.text(400, 380, 'Press R to return to lobby', { 
      fontSize: '16px', 
      color: '#cccccc',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5)

    this.input.keyboard?.once('keydown-R', () => {
      this.onGameEnd()
    })
  }
}

export default function MultiplayerTetris({ 
  roomId, 
  roomCode, 
  playerNumber, 
  playerName, 
  onGameEnd 
}: MultiplayerTetrisProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Phaser.Game | null>(null)
  const supabaseRef = useRef(createClientComponentClient())
  const gameInstanceRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true)
      gameInstanceRef.current = null
    }

    if (gameRef.current && !game) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: gameRef.current,
        backgroundColor: '#1a1a2e',
        scene: MultiplayerTetrisScene,
        render: {
          pixelArt: true,
          antialias: false,
          roundPixels: true
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      }

      const phaserGame = new Phaser.Game(config)
      gameInstanceRef.current = phaserGame
      phaserGame.scene.start('MultiplayerTetrisScene', { 
        roomId, 
        playerNumber, 
        playerName, 
        onGameEnd, 
        supabase: supabaseRef.current 
      })
      setGame(phaserGame)
    }

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true)
        gameInstanceRef.current = null
        setGame(null)
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Multiplayer Tetris</h2>
        <div className="text-gray-300">
          Room: <span className="text-yellow-400 font-mono">{roomCode}</span> | 
          Player {playerNumber}: <span className="text-blue-400">{playerName}</span>
        </div>
      </div>
      
      <div 
        ref={gameRef} 
        className="tetris-grid rounded-lg overflow-hidden shadow-2xl"
      />
      
      <button
        onClick={onGameEnd}
        className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
      >
        Leave Game
      </button>
    </div>
  )
}
