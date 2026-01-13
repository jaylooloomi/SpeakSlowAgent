import { useState, useCallback, useRef, useEffect } from 'react'

interface UseAudioRecorderReturn {
  isRecording: boolean
  isPaused: boolean
  volumeLevel: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  onAudioData: (callback: (data: ArrayBuffer) => void) => void
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCallbackRef = useRef<((data: ArrayBuffer) => void) | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // 設置音訊數據回調
  const onAudioData = useCallback((callback: (data: ArrayBuffer) => void) => {
    audioCallbackRef.current = callback
  }, [])

  // 更新音量計
  const updateVolumeMeter = useCallback(() => {
    if (!analyserRef.current || !isRecording) {
      setVolumeLevel(0)
      return
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // 計算平均音量
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setVolumeLevel(average / 255)

    animationFrameRef.current = requestAnimationFrame(updateVolumeMeter)
  }, [isRecording])

  // 開始錄音
  const startRecording = useCallback(async () => {
    setError(null)

    try {
      // 請求麥克風權限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      mediaStreamRef.current = stream

      // 創建 AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // 創建音源節點
      const source = audioContext.createMediaStreamSource(stream)

      // 創建分析器（用於音量計）
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      // 創建處理器節點（用於獲取音訊數據）
      // 注意：ScriptProcessorNode 已棄用，但 AudioWorklet 在某些情況下較複雜
      const bufferSize = 4096
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (isPaused) return

        const inputData = event.inputBuffer.getChannelData(0)

        // 將 Float32Array 轉換為 Int16Array (16-bit PCM)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          // 將 -1.0 到 1.0 的範圍轉換為 -32768 到 32767
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // 發送音訊數據
        if (audioCallbackRef.current) {
          audioCallbackRef.current(pcmData.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      setIsPaused(false)

      // 開始更新音量計
      updateVolumeMeter()

    } catch (err) {
      console.error('Failed to start recording:', err)
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('麥克風權限被拒絕')
        } else if (err.name === 'NotFoundError') {
          setError('找不到麥克風設備')
        } else {
          setError(`無法存取麥克風: ${err.message}`)
        }
      } else {
        setError('錄音啟動失敗')
      }
      throw err
    }
  }, [isPaused, updateVolumeMeter])

  // 停止錄音
  const stopRecording = useCallback(() => {
    // 停止動畫
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // 斷開處理器
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // 關閉 AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // 停止媒體流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    analyserRef.current = null
    setIsRecording(false)
    setIsPaused(false)
    setVolumeLevel(0)
  }, [])

  // 暫停錄音
  const pauseRecording = useCallback(() => {
    setIsPaused(true)
  }, [])

  // 繼續錄音
  const resumeRecording = useCallback(() => {
    setIsPaused(false)
  }, [])

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    isRecording,
    isPaused,
    volumeLevel,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    onAudioData,
  }
}
