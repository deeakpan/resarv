// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title RUSD
 * @notice Resarv USD stablecoin. Mint/burn restricted to the NFT CDP controller.
 */
contract RUSD {
    string public constant name = "Resarv USD";
    string public constant symbol = "rUSD";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public minter;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterUpdated(address indexed minter);

    modifier onlyOwner() {
        require(msg.sender == owner, "RUSD: not owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "RUSD: not minter");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "RUSD: zero");
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    function transferOwnership(address _owner) external onlyOwner {
        require(_owner != address(0), "RUSD: zero");
        owner = _owner;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyMinter {
        require(balanceOf[from] >= amount, "RUSD: burn exceeds");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "RUSD: allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "RUSD: zero to");
        require(balanceOf[from] >= amount, "RUSD: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
