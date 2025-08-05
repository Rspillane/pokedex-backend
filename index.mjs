import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Health Check Route
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Basic Root Route
app.get("/", (req, res) => {
  res.send("Hello from Pokedex backend!");
});

// Route 1: List of first 150 Pokémon
app.get("/api/pokemon", async (req, res) => {
  console.log("Received request for /api/pokemon");
  try {
    const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=150");
    const data = await response.json();

    const detailedPromises = data.results.map(async pokemon => {
      const res = await fetch(pokemon.url);
      const details = await res.json();
      return {
        id: details.id,
        name: details.name,
        sprite: details.sprites.front_default,
        types: details.types.map(t => t.type.name)
      };
    });

    // const pokemons = data.results.map(pokemon => {
    //   return {
    //     id: pokemon.id,
    //     name: pokemon.name,
    //     sprite: pokemon.sprites.front_default,
    //     types: pokemon.types.map(t => t.type.name)
    //   };
    // });

    const pokemons = await Promise.all(detailedPromises);
    res.json(pokemons);
  } catch (error) {
    console.error("Error fetching Pokémon list:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route 2: Detailed info for a single Pokémon
app.get("/api/pokemon/:name", async (req, res) => {
  const name = req.params.name.toLowerCase();

  function parseEvolutionChain(chain) {
    const evoArray = [];
    function traverse(chainNode) {
      evoArray.push(chainNode.species.name);
      if (chainNode.evolves_to.length > 0) {
        chainNode.evolves_to.forEach(evolve => traverse(evolve));
      }
    }
    traverse(chain);
    return evoArray;
  }

  try {
    const pokeResponse = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${name}`
    );
    if (!pokeResponse.ok) {
      return res.status(404).json({ error: "Pokémon not found" });
    }
    const pokeData = await pokeResponse.json();

    const speciesResponse = await fetch(pokeData.species.url);
    if (!speciesResponse.ok) {
      return res.status(404).json({ error: "Species data not found" });
    }
    const speciesData = await speciesResponse.json();

    const evoChainResponse = await fetch(speciesData.evolution_chain.url);
    if (!evoChainResponse.ok) {
      return res.status(404).json({ error: "Evolution chain data not found" });
    }
    const evoChainData = await evoChainResponse.json();

    const evolutionChain = parseEvolutionChain(evoChainData.chain);

    const result = {
      name: pokeData.name,
      height: pokeData.height / 10,
      weight: pokeData.weight / 10,
      habitat: speciesData.habitat ? speciesData.habitat.name : "unknown",
      evolutionChain,
      types: pokeData.types.map(t => t.type.name),
      abilities: pokeData.abilities.map(a => ({
        name: a.ability.name,
        is_hidden: a.is_hidden
      })),
      sprites: pokeData.sprites.front_default
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching Pokémon details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server (Only once!)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
