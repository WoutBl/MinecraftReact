import React from 'react';

interface StartScreenProps {
    onStart: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
    return (
        <div
            className="h-screen w-screen flex flex-col justify-center items-center bg-gray-800"
            style={{
                backgroundImage: "url('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png')",
                backgroundRepeat: "repeat",
                backgroundSize: "80px"
            }}
        >
            <h1 className="text-4xl font-bold text-white mb-8">Welcome to Minecraft in React</h1>
            <button
                onClick={onStart}
                className="px-6 py-3 bg-gray-300 text-gray-500 text-lg border border-gray-800 font-semibold  hover:bg-gray-400 transition"
            >
                Start Game
            </button>
        </div>
    );
};

export default StartScreen;