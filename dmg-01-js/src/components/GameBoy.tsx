import * as React from 'react'

import Screen from './Screen'
import _import from './dmg-01-js'
import { CPU, Joypad } from 'lib-dmg-01-js'
import Internals from './Internals'

enum RunningState {
  Uninitialized,
  Ready,
  Running,
  Paused
}

type Props = { bios: Uint8Array | undefined, rom: Uint8Array }
type State = { screenBuffer: Uint8Array, runningState: RunningState }

const CYCLES_PER_FRAME = 69905;

class Gameboy extends React.Component<Props, State> {
  cpu: CPU | undefined
  frameTimer: NodeJS.Timer | undefined

  constructor(props: Props) {
    super(props)
    this.state = { screenBuffer: new Uint8Array(144 * 160 * 4), runningState: RunningState.Uninitialized }
    _import().then(lib => {
      this.cpu = new lib.CPU(this.props.bios!, this.props.rom);
      (window as any).cpu = this.cpu
      this.setState({ runningState: RunningState.Ready })
    })
  }

  componentWillUnmount() {
    if (this.cpu) { this.cpu.free() }
  }

  render(): JSX.Element | null {
    if (this.state.runningState === RunningState.Uninitialized) { return null }
    const gameBoyStyles: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }

    return (
      <div style={gameBoyStyles} className="gameboy">
        <Screen buffer={this.state.screenBuffer} />
        {this.controls()}
        <Internals
          cpu={this.cpu!}
          isRunning={this.state.runningState === RunningState.Running}
          step={() => this.step()}
          stepFrame={() => this.stepFrame()}
        />
      </div>
    )
  }

  controls() {
    const controlsStyles = {
      display: 'flex',
      justifyContent: 'center',
      margin: '10px'
    }

    const { runningState } = this.state
    if (runningState === RunningState.Running) {
      return (
        <div style={controlsStyles}>
          {this.controlButton("Pause", () => this.pause())}
        </div>
      )
    } else if (runningState === RunningState.Ready) {
      return (
        <div style={controlsStyles}>
          {this.controlButton("Run", () => this.run())}
        </div>
      )
    } else {
      return (
        <div style={controlsStyles}>
          {this.controlButton("Run", () => this.run())}
          {this.controlButton("Reset", () => this.reset())}
        </div>
      )
    }
  }

  controlButton(label: string, onClick: () => void) {
    const controlStyles: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transform: 'rotate(-15deg)'
    }
    const controlButtonStyles = {
      background: 'linear-gradient(#80787c, #999094)',
      margin: '10px',
      width: '40px',
      height: '10px',
      borderRadius: '10px',
      cursor: 'pointer',
      boxShadow: '1px 1px 3px black'
    }
    const controlLabelStyles: React.CSSProperties = {
      marginTop: '-5px',
      textAlign: 'center',
      transform: 'scale(2.0, 1)',
      fontSize: '10px',
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
      color: '#403184'
    }
    return (
      <div style={controlStyles} className={`${label} control`} onClick={onClick}>
        <div style={controlButtonStyles} className={`${label} controlButton`}></div>
        <div style={controlLabelStyles} className="controlLabel">{label.toUpperCase()}</div>
      </div>
    )
  }

  run() {
    this.runFrame(0, true)
    this.setState({ runningState: RunningState.Running })
  }

  pause() {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer)
    }
    this.setState({ runningState: RunningState.Paused })
  }

  reset() {
    _import().then(lib => {
      this.cpu!.free()
      this.cpu = new lib.CPU(this.props.bios!, this.props.rom)
      this.calculateNextFrameBuffer()
      this.setState({ runningState: RunningState.Ready })
    })
  }

  step() {
    this.cpu!.step()
  }

  stepFrame() {
    this.runFrame(0, false)
    this.calculateNextFrameBuffer()
  }

  runFrame(previousTimeDiff: number, runContinuously: boolean) {
    this.frameTimer = setTimeout(() => {
      this.joypad()
      const t1 = window.performance.now()
      let cyclesElapsed = 0
      while (cyclesElapsed < CYCLES_PER_FRAME) {
        cyclesElapsed += this.cpu!.step()
      }
      if (runContinuously) {
        const t2 = window.performance.now()
        let timeDiff = 16.7 - (t2 - t1)

        if (previousTimeDiff < 0) { timeDiff = timeDiff + previousTimeDiff }

        this.runFrame(timeDiff, runContinuously)
        this.calculateNextFrameBuffer()
      }
    }, Math.max(previousTimeDiff, 0))
  }

  calculateNextFrameBuffer() {
    this.cpu!.canvas_buffer(this.state.screenBuffer)
    this.setState({ screenBuffer: this.state.screenBuffer })
  }

  joypad() {
    _import().then(lib => {
      function setButton(joypad: Joypad, keyCode: number, to: boolean) {
        switch (keyCode) {
          case 39: joypad.set_button(lib.Button.Right, to); break;
          case 37: joypad.set_button(lib.Button.Left, to); break;
          case 38: joypad.set_button(lib.Button.Up, to); break;
          case 40: joypad.set_button(lib.Button.Down, to); break;
          case 90: joypad.set_button(lib.Button.A, to); break;
          case 88: joypad.set_button(lib.Button.B, to); break;
          case 32: joypad.set_button(lib.Button.Select, to); break;
          case 13: joypad.set_button(lib.Button.Start, to); break;
        }
      }

      window.onkeydown = (e) => {
        const joypad = new lib.Joypad()
        setButton(joypad, e.keyCode, true)
        this.cpu!.set_joypad(joypad)
      }

      window.onkeyup = (e) => {
        const joypad = new lib.Joypad()
        setButton(joypad, e.keyCode, false)
        this.cpu!.set_joypad(joypad)
      }
    })
  }
}

export default Gameboy