import React, { useState } from 'react';
import MinecraftWorld from './components/MinecraftWorld';
import StartScreen from './components/StartScreen';

function App() {
  const [gameStarted, setGameStarted] = useState(false);

  const handleStartGame = () => {
    setGameStarted(true);
  };

  return (
    <div className="w-screen h-screen">
      {gameStarted ? <MinecraftWorld /> : <StartScreen onStart={handleStartGame} />}
    </div>
  );
}

export default App;