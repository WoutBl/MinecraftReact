export default function Crosshair() {
    return (
        <div className="fixed flex justify-center items-center top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <div className="absolute w-8 h-1 bg-white opacity-75"></div>
            <div className="absolute w-1 h-8 bg-white opacity-75"></div>
        </div>
    );
    }