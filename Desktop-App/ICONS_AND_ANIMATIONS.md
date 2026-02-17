# Icons and Animations Guide

This project now includes multiple icon and animation libraries for enhanced UI/UX.

## Installed Libraries

### Icons
1. **lucide-react** - Already installed, modern icon library
2. **react-icons** - Comprehensive icon library with multiple icon sets (Font Awesome, Material Design, Bootstrap, etc.)
3. **@heroicons/react** - Beautiful hand-crafted SVG icons from the makers of Tailwind CSS

### Animations
1. **framer-motion** - Production-ready motion library for React
2. **react-spring** - Spring-physics based animation library

## Usage Examples

### Icons

#### Lucide React (Already in use)
```tsx
import { CreditCard, User, Lock } from 'lucide-react';

<CreditCard className="w-6 h-6" />
```

#### React Icons
```tsx
import { FaUser, FaLock, FaCreditCard } from 'react-icons/fa';
import { MdLogin, MdSmartCard } from 'react-icons/md';
import { HiUser, HiLockClosed } from 'react-icons/hi';

<FaUser className="w-6 h-6" />
<MdSmartCard className="w-6 h-6" />
```

#### Heroicons
```tsx
import { CreditCardIcon, UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { CreditCardIcon as CreditCardSolid } from '@heroicons/react/24/solid';

<CreditCardIcon className="w-6 h-6" />
```

### Animations

#### Framer Motion
```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>

// Button with hover animation
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="px-8 py-3 bg-red-800 text-white"
>
  Click Me
</motion.button>
```

#### React Spring
```tsx
import { useSpring, animated } from 'react-spring';

function AnimatedComponent() {
  const props = useSpring({ 
    opacity: 1, 
    from: { opacity: 0 },
    transform: 'translateY(0px)',
    from: { transform: 'translateY(20px)' }
  });
  
  return <animated.div style={props}>Content</animated.div>;
}
```

## Quick Start Examples

### Animated Page Transition
```tsx
import { motion } from 'framer-motion';

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### Animated Button with Icon
```tsx
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';

<motion.button
  whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
  whileTap={{ scale: 0.95 }}
  className="px-8 py-4 bg-red-800 text-white font-bold rounded-lg flex items-center gap-3"
>
  <CreditCard className="w-6 h-6" />
  LOGIN VIA SMART CARD
</motion.button>
```

### Icon Sets Available in react-icons
- **Font Awesome**: `react-icons/fa`
- **Material Design**: `react-icons/md`
- **Bootstrap**: `react-icons/bs`
- **Feather**: `react-icons/fi`
- **Ionicons**: `react-icons/io`
- **And many more!**

## Documentation Links
- [Framer Motion Docs](https://www.framer.com/motion/)
- [React Spring Docs](https://www.react-spring.dev/)
- [React Icons](https://react-icons.github.io/react-icons/)
- [Heroicons](https://heroicons.com/)
- [Lucide Icons](https://lucide.dev/)

