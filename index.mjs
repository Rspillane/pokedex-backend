import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

// Postgres pool config
const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT, 10),
  ssl: { rejectUnauthorized: false }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Route to get list of basic pokemon info
app.get("/api/pokemon", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const sort = req.query.sort === "name" ? "name" : "id"; // default sort by id
    const typeFilter = req.query.type;

    // Base query and params array
    let baseQuery = "FROM pokemon";
    const params = [];

    // Add type filter if provided
    if (typeFilter) {
      params.push(`%${typeFilter}%`);
      baseQuery += ` WHERE types::text ILIKE $${params.length}`;
      // assuming types is stored as array or JSONB, casting to text for ILIKE
    }

    // Get total count for filtered dataset
    const countResult = await pool.query(
      `SELECT COUNT(*) ${baseQuery}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination params
    params.push(limit);
    params.push(offset);

    // Query for paginated, filtered, sorted results
    const queryText = `
      SELECT id, name, sprite, types
      ${baseQuery}
      ORDER BY ${sort} ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(queryText, params);

    res.json({
      results: result.rows,
      total
    });
  } catch (error) {
    console.error("Error querying database:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route to get detailed info for a single Pokémon
app.get("/api/pokemon/:name", async (req, res) => {
  const name = req.params.name.toLowerCase();

  try {
    // Query DB for Pokémon basic info
    const pokeResult = await pool.query(
      "SELECT * FROM pokemon WHERE name = $1",
      [name]
    );
    if (pokeResult.rowCount === 0) {
      return res.status(404).json({ error: "Pokémon not found" });
    }
    const pokeData = pokeResult.rows[0];

    // Since you don’t have detailed data in DB yet, fallback to PokeAPI for details
    const fetchResponse = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${name}`
    );
    if (!fetchResponse.ok) {
      return res.status(404).json({ error: "Pokémon details not found" });
    }
    const details = await fetchResponse.json();

    // Format the response with both DB basic info and fetched detailed info
    const result = {
      id: pokeData.id,
      name: pokeData.name,
      sprite: pokeData.sprite,
      types: pokeData.types,
      height: details.height / 10,
      weight: details.weight / 10,
      abilities: details.abilities.map(a => ({
        name: a.ability.name,
        is_hidden: a.is_hidden
      }))
      // Add more details as needed
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching Pokémon details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
