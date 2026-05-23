import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TpsScrollWrapper = ({ children }) => {
  const containerRef = useRef(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const checkScroll = () => {
    const el = containerRef.current;
    if (el) {
      // Check if the container actually has horizontal scroll overflow
      setIsScrollable(el.scrollWidth > el.clientWidth + 5);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      checkScroll();
      window.addEventListener('resize', checkScroll);
      
      const observer = new MutationObserver(checkScroll);
      observer.observe(el, { childList: true, subtree: true });

      return () => {
        window.removeEventListener('resize', checkScroll);
        observer.disconnect();
      };
    }
  }, [children]);

  const handleScroll = (direction) => {
    const el = containerRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col w-full border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
      {/* Scrollable Container (Table body) */}
      <div 
        ref={containerRef} 
        className="tps-responsive-table !mb-0 overflow-x-auto w-full"
        style={{ border: 'none' }}
      >
        {children}
      </div>

      {/* Bottom Scroll Control Panel */}
      {isScrollable && (
        <div className="flex items-center justify-between bg-[#FAFAFA] border-t border-[#E5E7EB] px-4 py-2.5 gap-4">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            style={{
              padding: '6px 16px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '0px',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={13} /> Skip Left
          </button>
          
          <span className="text-[10px] text-[#737373] uppercase font-mono tracking-wider font-bold">
            ◄ Scroll table horizontally to view all columns ►
          </span>

          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            style={{
              padding: '6px 16px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '0px',
              cursor: 'pointer'
            }}
          >
            Skip Right <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TpsScrollWrapper;
