import { useState } from 'react';
import api from '../api/axios';

export default function QuizPanel({ projectId }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'taking' | 'results'
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/quiz/generate', null, {
        params: { project_id: projectId, num_questions: numQuestions }
      });
      setQuiz(res.data);
      setAnswers(new Array(res.data.questions.length).fill(-1));
      setCurrentIdx(0);
      setPhase('taking');
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to generate quiz.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (optionIdx) => {
    const updated = [...answers];
    updated[currentIdx] = optionIdx;
    setAnswers(updated);
  };

  const handleNext = () => {
    if (answers[currentIdx] === -1) {
      alert('Please select an answer first.');
      return;
    }
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    setLoading(true);
    try {
      const res = await api.post('/quiz/submit', null, {
        params: { quiz_id: quiz.quiz_id, answers: JSON.stringify(answers) }
      });
      setResults(res.data);
      setPhase('results');
    } catch (err) {
      setMessage('❌ Failed to submit quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setPhase('idle');
    setQuiz(null);
    setAnswers([]);
    setCurrentIdx(0);
    setResults(null);
    setMessage('');
  };

  // ===== RENDER =====
  return (
    <div style={styles.container}>
      <h4 style={styles.title}>📝 Quiz Yourself</h4>

      {phase === 'idle' && (
        <>
          <p style={styles.text}>Generate a quiz from this project's content.</p>
          <div style={styles.controls}>
            <label style={styles.label}>Questions:</label>
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              style={styles.select}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <button onClick={handleGenerate} disabled={loading} style={styles.primaryButton}>
              {loading ? 'Generating...' : 'Generate Quiz'}
            </button>
          </div>
          {message && <p style={styles.message}>{message}</p>}
        </>
      )}

      {phase === 'taking' && quiz && (
        <div>
          <p style={styles.progress}>
            Question {currentIdx + 1} of {quiz.questions.length}
          </p>
          <h5 style={styles.questionText}>
            {quiz.questions[currentIdx].question}
          </h5>
          <div style={styles.optionsList}>
            {quiz.questions[currentIdx].options.map((opt, i) => (
              <label key={i} style={{
                ...styles.optionLabel,
                backgroundColor: answers[currentIdx] === i ? '#e0f0ff' : 'white',
                borderColor: answers[currentIdx] === i ? '#007bff' : '#ddd'
              }}>
                <input
                  type="radio"
                  checked={answers[currentIdx] === i}
                  onChange={() => handleSelect(i)}
                  style={styles.radio}
                />
                {opt}
              </label>
            ))}
          </div>
          <button
            onClick={handleNext}
            disabled={loading}
            style={styles.primaryButton}
          >
            {currentIdx < quiz.questions.length - 1 ? 'Next →' : 'Submit Quiz'}
          </button>
        </div>
      )}

      {phase === 'results' && results && (
        <div>
          <h3 style={styles.scoreText}>
            🎯 Score: {results.score} / {results.total_questions}
          </h3>
          <div style={styles.resultsList}>
            {results.details.map((d, i) => (
              <div key={i} style={{
                ...styles.resultItem,
                borderLeftColor: d.is_correct ? '#28a745' : '#dc3545'
              }}>
                <p style={styles.resultQuestion}>
                  <strong>Q{i + 1}:</strong> {d.question}
                </p>
                <p style={d.is_correct ? styles.correctAnswer : styles.wrongAnswer}>
                  {d.is_correct ? '✅ Correct' : '❌ Wrong'}
                </p>
                {!d.is_correct && (
                  <p style={styles.explanation}>
                    <strong>Correct answer:</strong> {d.correct_answer}
                    <br />
                    <em>{d.explanation}</em>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button onClick={handleRestart} style={styles.primaryButton}>
            Take Another Quiz
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#fff8e1', borderRadius: '10px', border: '1px solid #ffe082' },
  title: { marginTop: 0, marginBottom: '10px' },
  text: { margin: '10px 0', color: '#555' },
  controls: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  label: { fontSize: '14px', fontWeight: '600' },
  select: { padding: '6px 10px', borderRadius: '5px', border: '1px solid #ccc' },
  primaryButton: { padding: '10px 20px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  message: { marginTop: '10px', color: '#333' },
  progress: { color: '#888', fontSize: '13px', margin: '5px 0' },
  questionText: { fontSize: '16px', margin: '10px 0 15px 0' },
  optionsList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' },
  optionLabel: { display: 'flex', alignItems: 'center', padding: '10px', borderRadius: '6px', border: '2px solid', cursor: 'pointer', fontSize: '14px' },
  radio: { marginRight: '10px' },
  scoreText: { color: '#ff6f00', marginBottom: '15px' },
  resultsList: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' },
  resultItem: { padding: '12px', backgroundColor: 'white', borderRadius: '6px', borderLeft: '4px solid', marginBottom: '5px' },
  resultQuestion: { margin: '0 0 6px 0', fontSize: '14px' },
  correctAnswer: { color: '#28a745', fontWeight: 'bold', margin: '3px 0' },
  wrongAnswer: { color: '#dc3545', fontWeight: 'bold', margin: '3px 0' },
  explanation: { fontSize: '13px', color: '#666', margin: '5px 0 0 0' }
};