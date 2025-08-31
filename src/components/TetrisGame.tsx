'use client'

import { useEffect, useRef, useState } from 'react'
import * as Phaser from 'phaser'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface TetrisGameProps {
  playerName: string
  onGameEnd: () => void
}

class TetrisScene extends Phaser.Scene {
  private grid: (string | number)[][]
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
  private playerName!: string
  private onGameEnd!: () => void
  private supabase: any
  private gridLayer?: Phaser.GameObjects.Container
  private ghostLayer?: Phaser.GameObjects.Container
  private pieceLayer?: Phaser.GameObjects.Container
  private nextLayer?: Phaser.GameObjects.Container
  private holdLayer?: Phaser.GameObjects.Container
  private hasHeldThisTurn: boolean

  constructor() {
    super({ key: 'TetrisScene' })
    this.grid = []
    this.score = 0
    this.level = 1
    this.lines = 0
  this.combo = 0
    this.dropTime = 1000
    this.lastDropTime = 0
    this.gameOver = false
  this.holdPiece = null
  this.hasHeldThisTurn = false
  }

  init(data: any) {
    this.playerName = data.playerName
    this.onGameEnd = data.onGameEnd
    this.supabase = data.supabase
  }

  preload() {
    // Generate solid tile textures per color (no strokes) to avoid seams between adjacent blocks
    const colors = ['cyan', 'yellow', 'purple', 'orange', 'blue', 'green', 'red', 'gray']

    colors.forEach(color => {
      const g = this.add.graphics()
      // Solid fill only
      g.fillStyle(this.getColorHex(color), 1)
      g.fillRect(0, 0, 28, 28)
      // Important: no inner/outer strokes; they create visible cross-lines when tiles touch
      g.generateTexture(color, 28, 28)
      g.destroy()
    })
  }

  create() {
  // Clear any existing objects first
  this.children.removeAll()
    
    this.initializeGrid()
    // Initialize next piece and spawn the first current piece from it
    this.nextPiece = this.generateRandomPiece()
    this.spawnNewPiece()
  // Create render layers to avoid leftover artifacts between frames
  this.gridLayer = this.add.container(0, 0)
  this.ghostLayer = this.add.container(0, 0)
  this.pieceLayer = this.add.container(0, 0)
  this.nextLayer = this.add.container(0, 0)
  this.holdLayer = this.add.container(0, 0)

  this.createUI()
    this.setupInput()
    this.renderGrid() // Initial render
    
    // Show mobile touch instructions if on touch device
    this.showMobileTouchInstructions()
  }

  update(time: number) {
    if (this.gameOver) return

    if (time - this.lastDropTime > this.dropTime) {
      this.dropPiece()
      this.lastDropTime = time
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
      gray: 0x808080
    }
    return colors[color] || 0x808080
  }

  private initializeGrid() {
    this.grid = Array(20).fill(null).map(() => Array(10).fill(0))
  }

  private generateRandomPiece() {
    const pieces = [
      { 
        shape: [ [1,1,1,1] ], 
        color: 'cyan' 
      },
      { 
        shape: [ [1,1],[1,1] ], 
        color: 'yellow' 
      },
      { 
        shape: [ [0,1,0],[1,1,1] ], 
        color: 'purple' 
      },
      { 
        shape: [ [0,1,1],[1,1,0] ], 
        color: 'green' 
      },
      { 
        shape: [ [1,1,0],[0,1,1] ], 
        color: 'red' 
      },
      { 
        shape: [ [1,0,0],[1,1,1] ], 
        color: 'orange' 
      },
      { 
        shape: [ [0,0,1],[1,1,1] ], 
        color: 'blue' 
      }
    ]
    const base = pieces[Math.floor(Math.random() * pieces.length)]
    // Deep copy shape to avoid mutations across uses
    const shape = base.shape.map(row => [...row])
    return { shape, color: base.color }
  }

  private spawnNewPiece() {
    // Pull from nextPiece queue
    const usePiece = this.nextPiece || this.generateRandomPiece()
    // Deep copy shape so rotations don't affect previews
    const shape = usePiece.shape.map((row: any[]) => [...row])
    this.currentPiece = {
      shape,
      color: usePiece.color,
      x: Math.floor((10 - shape[0].length) / 2), // Center the piece horizontally
      y: 0
    }
    // Prepare the next piece for preview
    this.nextPiece = this.generateRandomPiece()
    this.hasHeldThisTurn = false
    this.combo = this.combo // unchanged here; reset only on no-clear

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
      if (cleared > 0) {
        this.lines += cleared
        this.score += cleared * 100 * this.level
        this.combo += 1
        if (this.combo > 1) {
          this.score += (this.combo - 1) * 50 * this.level
        }
        this.level = Math.floor(this.lines / 10) + 1
        this.dropTime = Math.max(100, 1000 - (this.level - 1) * 100)
        this.updateUI()
      } else {
        this.combo = 0
        this.updateUI()
      }
      this.spawnNewPiece()
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
        y++ // Check the same line again
      }
    }
    return linesCleared
  }

  private renderGrid() {
    // Clear layers fully to avoid ghost artifacts
    this.gridLayer?.removeAll(true)
    this.ghostLayer?.removeAll(true)
    this.pieceLayer?.removeAll(true)
  this.nextLayer?.removeAll(true)
  this.holdLayer?.removeAll(true)

    // Render placed pieces first
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x]) {
          const block = this.add.image(x * 28 + 14, y * 28 + 14, this.grid[y][x] as string)
          block.setOrigin(0.5, 0.5)
          this.gridLayer?.add(block)
        }
      }
    }

    // Render ghost piece (where current piece will land)
    if (this.currentPiece) {
      const ghostPiece = { 
        ...this.currentPiece,
        shape: [...this.currentPiece.shape.map((row: any[]) => [...row])] // Deep copy
      }
      
      // Find where the piece will land
      while (!this.checkCollision(ghostPiece, 0, 1)) {
        ghostPiece.y++
      }

      // Only render ghost if it's below the current piece
      if (ghostPiece.y > this.currentPiece.y) {
        for (let y = 0; y < ghostPiece.shape.length; y++) {
          for (let x = 0; x < ghostPiece.shape[y].length; x++) {
            if (ghostPiece.shape[y][x]) {
              const ghostBlock = this.add.image(
                (ghostPiece.x + x) * 28 + 14,
                (ghostPiece.y + y) * 28 + 14,
                ghostPiece.color
              )
              ghostBlock.setOrigin(0.5, 0.5)
              ghostBlock.setAlpha(0.25) // More transparent
              this.ghostLayer?.add(ghostBlock)
            }
          }
        }
      }
    }

    // Render current falling piece last (on top)
    if (this.currentPiece) {
      for (let y = 0; y < this.currentPiece.shape.length; y++) {
        for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
          if (this.currentPiece.shape[y][x]) {
            const block = this.add.image(
              (this.currentPiece.x + x) * 28 + 14,
              (this.currentPiece.y + y) * 28 + 14,
              this.currentPiece.color
            )
            block.setOrigin(0.5, 0.5)
            block.setDepth(100) // Ensure it's on top
            this.pieceLayer?.add(block)
          }
        }
      }
    }

    // Render NEXT preview (top-right box)
    if (this.nextPiece) {
      this.drawPreview(this.nextPiece, 360, 360, this.nextLayer!)
    }

    // Render HOLD preview (below next)
    if (this.holdPiece) {
      this.drawPreview(this.holdPiece, 360, 460, this.holdLayer!)
    }
  }

  private drawPreview(piece: any, centerX: number, centerY: number, layer: Phaser.GameObjects.Container) {
    // Determine piece bounding box
    const rows = piece.shape.length
    const cols = piece.shape[0].length
    const tile = 20 // preview tile size
    // Center around provided point
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (piece.shape[y][x]) {
          const img = this.add.image(centerX + (x - cols / 2 + 0.5) * tile, centerY + (y - rows / 2 + 0.5) * tile, piece.color)
          img.setDisplaySize(tile, tile)
          img.setOrigin(0.5, 0.5)
          layer.add(img)
        }
      }
    }
  }

  private drawGridLines(x: number, y: number, width: number, height: number, color: number, alpha: number) {
    const gridGraphics = this.add.graphics()
    gridGraphics.lineStyle(1, color, alpha)
    
    // Draw vertical lines (28px spacing for blocks in single-player)
    for (let i = 28; i < width; i += 28) {
      gridGraphics.moveTo(x + i, y)
      gridGraphics.lineTo(x + i, y + height)
    }
    
    // Draw horizontal lines (28px spacing for blocks in single-player)
    for (let i = 28; i < height; i += 28) {
      gridGraphics.moveTo(x, y + i)
      gridGraphics.lineTo(x + width, y + i)
    }
    
    gridGraphics.strokePath()
  }

  private createUI() {
    // Enhanced game board background and border
    const bgBoard = this.add.graphics()
    bgBoard.fillStyle(0x1a1a2e, 0.3)
    bgBoard.fillRect(0, 0, 280, 560)
    
    // Draw grid lines for better visual reference
    this.drawGridLines(0, 0, 280, 560, 0x00ffff, 0.1)
    
    // Enhanced game border with gradient effect
    const graphics = this.add.graphics()
    graphics.lineStyle(3, 0x00ffff, 1)
    graphics.strokeRect(-1, -1, 282, 562)
    graphics.lineStyle(1, 0x00cccc, 0.5)
    graphics.strokeRect(1, 1, 278, 558)

    // Enhanced stats panel background
    const statsPanel = this.add.graphics()
    statsPanel.fillStyle(0x1a1a2e, 0.4)
    statsPanel.fillRect(290, 40, 160, 200)
    statsPanel.lineStyle(2, 0x00ffff, 0.8)
    statsPanel.strokeRect(290, 40, 160, 200)

    // Score display with enhanced styling
    this.add.text(300, 50, 'SCORE', { 
      fontSize: '20px', 
      color: '#00ffff',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 80, '0', { 
      fontSize: '24px', 
      color: '#ffff00',
      fontFamily: 'Orbitron, monospace',
      stroke: '#000000',
      strokeThickness: 1
    }).setName('scoreText')
    
    this.add.text(300, 140, 'LEVEL', { 
      fontSize: '20px', 
      color: '#00ffff',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 170, '1', { 
      fontSize: '24px', 
      color: '#ffff00',
      fontFamily: 'Orbitron, monospace',
      stroke: '#000000',
      strokeThickness: 1
    }).setName('levelText')
    
    this.add.text(300, 230, 'LINES', { 
      fontSize: '20px', 
      color: '#00ffff',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 260, '0', { 
      fontSize: '24px', 
      color: '#ffff00',
      fontFamily: 'Orbitron, monospace',
      stroke: '#000000',
      strokeThickness: 1
    }).setName('linesText')

  this.add.text(300, 300, 'COMBO', { fontSize: '20px', color: '#ffffff' })
  this.add.text(300, 330, '0', { fontSize: '24px', color: '#00ffcc' }).setName('comboText')

  // Next and Hold boxes
  const g2 = this.add.graphics()
  g2.lineStyle(1, 0xcccccc)
  // NEXT box
  this.add.text(300, 360 - 30, 'NEXT', { fontSize: '16px', color: '#ffffff' })
  g2.strokeRect(320, 360 - 20, 120, 80)
  // HOLD box
  this.add.text(300, 460 - 30, 'HOLD', { fontSize: '16px', color: '#ffffff' })
  g2.strokeRect(320, 460 - 20, 120, 80)

    // Enhanced controls with mobile touch instructions
    this.add.text(300, 510, 'CONTROLS:', { 
      fontSize: '16px', 
      color: '#00ffff',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 530, 'A/D - Move | S - Soft Drop', { 
      fontSize: '12px', 
      color: '#cccccc',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 545, 'W - Rotate | Space - Hard Drop | Shift - Hold', { 
      fontSize: '12px', 
      color: '#cccccc',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 570, 'TOUCH: Swipe L/R - Move | Tap - Rotate', { 
      fontSize: '11px', 
      color: '#00ffcc',
      fontFamily: 'Orbitron, monospace'
    })
    this.add.text(300, 585, 'Swipe Down - Drop | Right Tap - Hold', { 
      fontSize: '11px', 
      color: '#00ffcc',
      fontFamily: 'Orbitron, monospace'
    })
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
    const cursors = this.input.keyboard?.createCursorKeys()
    const wasd = this.input.keyboard?.addKeys('W,S,A,D,SPACE')

    // Keyboard controls
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.gameOver) return

      switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
          if (!this.checkCollision(this.currentPiece, -1, 0)) {
            this.currentPiece.x--
            this.renderGrid()
          }
          break
        case 'KeyD':
        case 'ArrowRight':
          if (!this.checkCollision(this.currentPiece, 1, 0)) {
            this.currentPiece.x++
            this.renderGrid()
          }
          break
        case 'KeyS':
        case 'ArrowDown':
          if (!this.checkCollision(this.currentPiece, 0, 1)) {
            this.currentPiece.y++
            this.renderGrid()
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

    // Touch controls for mobile devices
    this.setupTouchControls()
  }

  private setupTouchControls() {
    // Touch variables
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0
    const swipeThreshold = 50
    const tapThreshold = 200 // ms for distinguishing tap vs swipe

    // Add touch event listeners to the game canvas
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return
      
      touchStartX = pointer.x
      touchStartY = pointer.y
      touchStartTime = Date.now()
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return

      const touchEndX = pointer.x
      const touchEndY = pointer.y
      const touchEndTime = Date.now()
      const touchDuration = touchEndTime - touchStartTime

      const deltaX = touchEndX - touchStartX
      const deltaY = touchEndY - touchStartY
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Handle tap gestures (short duration, small movement)
      if (touchDuration < tapThreshold && absDeltaX < 30 && absDeltaY < 30) {
        // Determine tap location for different actions
        if (touchStartX < 140) {
          // Left side of screen - rotate
          this.rotatePiece()
        } else if (touchStartX > 300) {
          // Right side of screen - hold piece
          this.holdCurrentPiece()
        } else {
          // Center - rotate (default action)
          this.rotatePiece()
        }
        return
      }

      // Handle swipe gestures
      if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          if (deltaX > 0) {
            // Swipe right - move right
            if (!this.checkCollision(this.currentPiece, 1, 0)) {
              this.currentPiece.x++
              this.renderGrid()
            }
          } else {
            // Swipe left - move left
            if (!this.checkCollision(this.currentPiece, -1, 0)) {
              this.currentPiece.x--
              this.renderGrid()
            }
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            // Swipe down - soft drop or hard drop based on speed
            if (touchDuration < 150) {
              // Fast swipe down - hard drop
              this.hardDrop()
            } else {
              // Slow swipe down - soft drop
              if (!this.checkCollision(this.currentPiece, 0, 1)) {
                this.currentPiece.y++
                this.renderGrid()
              }
            }
          }
          // Swipe up could be used for rotate as alternative
          else {
            this.rotatePiece()
          }
        }
      }
    })
  }

  private showMobileTouchInstructions() {
    // Detect if device supports touch
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    if (isTouchDevice) {
      // Create a temporary overlay with touch instructions
      const overlay = this.add.graphics()
      overlay.fillStyle(0x000000, 0.8)
      overlay.fillRect(0, 0, 450, 600)
      overlay.setDepth(1000)
      
      const instructionText = this.add.text(225, 250, 'TOUCH CONTROLS', {
        fontSize: '20px',
        color: '#00ffff',
        fontFamily: 'Orbitron, monospace'
      }).setOrigin(0.5).setDepth(1001)
      
      const instructionDetails = this.add.text(225, 300, 
        'Swipe Left/Right - Move\n' +
        'Tap Left - Rotate\n' +
        'Swipe Down - Drop\n' +
        'Tap Right - Hold\n\n' +
        'Tap to start!', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Orbitron, monospace',
        align: 'center'
      }).setOrigin(0.5).setDepth(1001)
      
      // Remove overlay on first touch/click
      const removeOverlay = () => {
        overlay.destroy()
        instructionText.destroy()
        instructionDetails.destroy()
        this.input.off('pointerdown', removeOverlay)
      }
      
      this.input.once('pointerdown', removeOverlay)
      
      // Auto-remove after 4 seconds
      this.time.delayedCall(4000, removeOverlay)
    }
  }

  private rotatePiece() {
    // Don't rotate O-piece (square)
    if (this.currentPiece.color === 'yellow') return

    // Create rotated shape: transpose and reverse each row
    const rotated = this.currentPiece.shape[0].map((_: any, index: number) =>
      this.currentPiece.shape.map((row: any[]) => row[index]).reverse()
    )

    const oldShape = this.currentPiece.shape
    const oldX = this.currentPiece.x
    this.currentPiece.shape = rotated

    // Try rotation at current position
    if (!this.checkCollision(this.currentPiece)) {
      this.renderGrid()
      return
    }

    // Try wall kicks (move left/right if rotation doesn't fit)
    const kicks = [-1, 1, -2, 2]
    for (const kick of kicks) {
      this.currentPiece.x = oldX + kick
      if (!this.checkCollision(this.currentPiece)) {
        this.renderGrid()
        return
      }
    }

    // If all kicks fail, revert rotation
    this.currentPiece.shape = oldShape
    this.currentPiece.x = oldX
  }

  private hardDrop() {
    while (!this.checkCollision(this.currentPiece, 0, 1)) {
      this.currentPiece.y++
    }
    this.placePiece()
    const cleared = this.clearLines()
    if (cleared > 0) {
      this.lines += cleared
      this.score += cleared * 100 * this.level
      this.combo += 1
      if (this.combo > 1) {
        this.score += (this.combo - 1) * 50 * this.level
      }
      this.level = Math.floor(this.lines / 10) + 1
      this.dropTime = Math.max(100, 1000 - (this.level - 1) * 100)
      this.updateUI()
    } else {
      this.combo = 0
      this.updateUI()
    }
    this.spawnNewPiece()
    this.renderGrid()
  }

  private holdCurrentPiece() {
    if (this.hasHeldThisTurn || this.gameOver) return
    // Store current without position
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
        // If cannot place swapped piece, end game
        this.endGame()
      }
    }
    this.hasHeldThisTurn = true
    this.renderGrid()
  }

  private async endGame() {
    this.gameOver = true
    
    // Save score to Supabase
    try {
      await this.supabase
        .from('scores')
        .insert([
          { 
            player_name: this.playerName, 
            score: this.score, 
            level: this.level, 
            lines: this.lines 
          }
        ])
    } catch (error) {
      console.error('Error saving score:', error)
    }

    this.add.text(150, 250, 'GAME OVER', { 
      fontSize: '32px', 
      color: '#ff0000',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)

    this.add.text(150, 300, `Final Score: ${this.score}`, { 
      fontSize: '18px', 
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5)

    this.add.text(150, 330, 'Press R to restart', { 
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

export default function TetrisGame({ playerName, onGameEnd }: TetrisGameProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Phaser.Game | null>(null)
  const supabaseRef = useRef(createClientComponentClient())
  const gameInstanceRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    // Cleanup any existing game instance first
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true)
      gameInstanceRef.current = null
    }

    if (gameRef.current && !game) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 480,
        height: 560,
        parent: gameRef.current,
        backgroundColor: '#1a1a2e',
        scene: TetrisScene,
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
      phaserGame.scene.start('TetrisScene', { playerName, onGameEnd, supabase: supabaseRef.current })
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
      <div 
        ref={gameRef} 
        className="tetris-grid rounded-lg overflow-hidden shadow-2xl"
      />
      <button
        onClick={onGameEnd}
        className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
      >
        Back to Menu
      </button>
    </div>
  )
}
