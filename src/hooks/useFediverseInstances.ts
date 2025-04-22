// import { useEffect, useState } from "react";

// export function useFediverseInstances() {
//   const [fediverseInstances, setFediverseInstances] = useState<string[]>([]);
  
//   useEffect(() => {
//     const fetchFediverseInstances = async () => {
//       try {
//         // You'll need to create this API endpoint
//         const response = await fetch('/api/auth/fediverse');
//         const data = await response.json();
//         if (data.success) {
//           setFediverseInstances(data.instances);
//         }
//       } catch (error) {
//         console.error('Error fetching Fediverse instances:', error);
//       }
//     };
    
//     fetchFediverseInstances();
//   }, []);
  
//   return fediverseInstances;
// }