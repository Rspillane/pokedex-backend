import fetch from "node-fetch";
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pkg;

// Postgres connection config — replace with your Render database credentials

const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT, 10),
  ssl: { rejectUnauthorized: false }
});

async function fetchAndStorePokemon() {
  try {
    // Fetch list of first 150 pokemon
    const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=150");
    const data = await response.json();

    for (const pokemon of data.results) {
      // Fetch detailed info to get id, sprite, and types
      const detailsRes = await fetch(pokemon.url);
      const details = await detailsRes.json();

      const id = details.id;
      const name = details.name;
      const sprite = details.sprites.front_default;
      const types = details.types.map(t => t.type.name);

      // Insert into database
      await pool.query(
        `INSERT INTO pokemon (id, name, sprite, types)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [id, name, sprite, types]
      );

      console.log(`Inserted Pokémon: ${name}`);
    }

    console.log("All Pokémon inserted!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

fetchAndStorePokemon();
