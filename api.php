<?php
// Ativando a exibição de todos os erros para ajudar a depurar
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<!DOCTYPE html>";
echo "<html lang='pt-br'>";
echo "<head>";
echo "<meta charset='UTF-8'>";
echo "<title>login realizado</title>";
echo '<link href="https://bootswatch.com/5/morph/bootstrap.min.css" rel="stylesheet">';
echo "</head>";
echo "<body>";
echo "<div class='container mt-5'>";
echo "<h1>cadastro realizado</h1>";
// Verificando se o método de requisição é POST, pois e mais seguro
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $nomeUsuario = $_POST["nome"];
    $email = $_POST["email"];
    $senha = $_POST["senha"]; // no projeto real nn vai ter isso, 

    echo "<div class='alert alert-success'>";
    echo "<p><strong>Nome:</strong> " . htmlspecialchars($nomeUsuario) . "</p>";
    echo "<p><strong>E-mail:</strong> " . htmlspecialchars($email) . "</p>";
    echo "<p><strong>Senha (apenas para teste):</strong> " . htmlspecialchars($senha) . "</p>";
    echo "</div>";

} else {
    echo "<div class='alert alert-danger'>Erro: O formulário não foi enviado corretamente.</div>";
}

echo "<a href='index.html' class='btn btn-secondary'>Voltar</a>";
echo "</div>";
echo "</body>";
