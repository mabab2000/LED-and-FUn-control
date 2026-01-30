import { useEffect, useRef, useState } from 'react';
import './App.css';

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const win: any = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) finalTranscript += text + ' ';
        }

        if (finalTranscript) setTranscript((t) => t + finalTranscript);

        try {
          sendToApi(finalTranscript.trim());
        } catch (e) {}

        try {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        } catch (e) {}

        silenceTimerRef.current = window.setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {}
          }
        }, 1500);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let message = 'An error occurred: ' + event.error;
        if (event.error === 'not-allowed') message = 'Microphone permission denied.';
        window.alert(message);
        stopListening();
      };

      recognition.onend = () => {
        try {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } catch (e) {}
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  async function sendToApi(text: string) {
    if (!text || !text.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('https://iot-omxk.onrender.com/analyze', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('analysis response', data);
      const resultText = data?.result != null ? String(data.result) : null;
      setApiResult(resultText);
    } catch (e) {
      console.warn('Failed to send text to API', e);
      setApiResult(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function startListening() {
    const rec = recognitionRef.current;
    if (!rec) {
      window.alert('SpeechRecognition not available in this browser.');
      return;
    }
    try {
      rec.start();
      try {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } catch (e) {}
    } catch (e) {}
  }

  function stopListening() {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {}
    }
    try {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } catch (e) {}
    setIsListening(false);
  }

  function toggleListening() {
    if (isListening) stopListening();
    else startListening();
  }

  return (
    <div className="app-root">
      <div className="card">
        <button
          aria-label="Start/stop recording"
          className={`mic-button ${isListening ? 'listening' : ''} ${isLoading ? 'disabled' : ''}`}
          onClick={toggleListening}
          disabled={isLoading}
        >
          <span className="mic-emoji">{isListening ? '🎙️' : '🎤'}</span>
        </button>

        <div className={`status ${isListening ? 'listening' : ''} ${isLoading ? 'loading' : ''}`}>
          {isLoading ? 'Analyzing...' : isListening ? 'Listening...' : 'Click the microphone to start'}
        </div>

        {isLoading && <div className="spinner" aria-hidden />}

        {apiResult && (
          <div className="api-result">
            <div className="api-result-title">Analysis result</div>
            <div className="api-result-body">{apiResult}</div>
          </div>
        )}

        <textarea
          className="transcript"
          rows={8}
          readOnly
          value={transcript}
          placeholder="Your speech will appear here..."
        />

        <button className="clear-button" onClick={() => { setTranscript(''); setApiResult(null); }} disabled={isLoading}>
          Clear Text
        </button>
      </div>
    </div>
  );
}
