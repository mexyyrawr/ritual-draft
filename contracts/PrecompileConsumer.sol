// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PrecompileConsumer — base contract for calling Ritual precompiles
abstract contract PrecompileConsumer {
    address constant LLM_INFERENCE_PRECOMPILE = 0x0000000000000000000000000000000000000802;
    address constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    function _executePrecompile(address precompile, bytes memory input) internal returns (bytes memory output) {
        (bool success, bytes memory result) = precompile.call(input);
        require(success, "Precompile call failed");
        output = result;
    }

    function depositForFees() external payable {
        (bool ok,) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSignature("deposit(uint256)", 100000)
        );
        require(ok, "Deposit failed");
    }

    receive() external virtual payable {}
}
