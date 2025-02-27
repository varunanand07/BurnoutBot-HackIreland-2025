import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Initialize Firebase
let db;

try {
  // Check if we're in a production environment
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Use environment variables for service account
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore();
    console.log('Firebase initialized successfully with environment variables');
  } else {
    try {
      // Try to use local service account file for development
      const serviceAccount = require('../../serviceAccountKey.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      db = admin.firestore();
      console.log('Firebase initialized successfully with local service account');
    } catch (fileError) {
      console.warn('Service account file not found, using mock Firestore');
      throw new Error('Service account file not found');
    }
  }
} catch (error) {
  console.warn('Using mock Firestore for development:', error.message);
  
  // Create a mock Firestore for development
  db = {
    collection: (name) => ({
      doc: (id) => ({
        set: async (data) => console.log(`Mock set ${name}/${id}:`, data),
        get: async () => ({ 
          exists: false, 
          data: () => null,
          id: id
        }),
        delete: async () => console.log(`Mock delete ${name}/${id}`)
      }),
      add: async (data) => {
        console.log(`Mock add to ${name}:`, data);
        return { id: 'mock-id-' + Date.now() };
      },
      where: () => ({
        where: () => ({ 
          where: () => ({ 
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  get: async () => ({ 
                    forEach: () => {},
                    docs: []
                  })
                })
              })
            }) 
          }),
          orderBy: () => ({ 
            limit: () => ({ 
              get: async () => ({ 
                forEach: () => {},
                docs: []
              }) 
            }) 
          }),
          get: async () => ({ 
            forEach: () => {},
            docs: []
          })
        }),
        orderBy: () => ({ 
          limit: () => ({ 
            get: async () => ({ 
              forEach: () => {},
              docs: []
            }) 
          }) 
        }),
        get: async () => ({ 
          forEach: () => {},
          docs: []
        })
      }),
      get: async () => ({
        forEach: () => {},
        docs: []
      })
    })
  };
}

export { db }; 